// Font Changer and Replacer - Main Plugin Code
// This file runs in Figma's sandbox environment

figma.showUI(__html__, { 
  themeColors: true, 
  width: 520, 
  height: 640
});

// Types
interface FontInfo {
  family: string;
  style: string;
  count: number;
}

interface FontMapping {
  oldFamily: string;
  oldStyle: string;
  newFamily: string;
  newStyle: string;
}

interface FontRange {
  start: number;
  end: number;
  font: FontName;
}

type ScanScope = 'selection' | 'page' | 'document';

// Common font families available in most systems
const COMMON_FONTS = [
  'Inter', 'Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Poppins', 'Source Sans Pro',
  'Nunito', 'Raleway', 'Ubuntu', 'Playfair Display', 'Merriweather', 'PT Sans',
  'Noto Sans', 'Work Sans', 'Fira Sans', 'Quicksand', 'Karla', 'Rubik', 'Barlow',
  'DM Sans', 'Manrope', 'Space Grotesk', 'Plus Jakarta Sans', 'Outfit',
  'Arial', 'Helvetica', 'Times New Roman', 'Georgia', 'Verdana', 'Tahoma',
  'SF Pro', 'SF Pro Display', 'SF Pro Text', 'New York', 'Helvetica Neue',
  'Segoe UI', 'Calibri', 'Cambria', 'Consolas', 'Courier New'
];

// Common font styles/weights
const COMMON_STYLES = [
  'Thin', 'ExtraLight', 'Light', 'Regular', 'Medium', 'SemiBold', 'Bold', 'ExtraBold', 'Black',
  'Thin Italic', 'ExtraLight Italic', 'Light Italic', 'Italic', 'Medium Italic', 
  'SemiBold Italic', 'Bold Italic', 'ExtraBold Italic', 'Black Italic'
];

// Helper: Collect all unique fonts used in the entire document
function collectDocumentFonts(): { families: string[], styles: Map<string, string[]> } {
  const familySet = new Set<string>();
  const stylesByFamily = new Map<string, Set<string>>();
  
  // Scan all pages
  for (const page of figma.root.children) {
    try {
      const textNodes = findAllTextNodes([...page.children]);
      for (const node of textNodes) {
        const fonts = extractFontsFromTextNode(node);
        for (const font of fonts) {
          familySet.add(font.family);
          if (!stylesByFamily.has(font.family)) {
            stylesByFamily.set(font.family, new Set());
          }
          stylesByFamily.get(font.family)!.add(font.style);
        }
      }
    } catch (e) {
      // Page not loaded, skip
    }
  }
  
  // Add common fonts
  for (const font of COMMON_FONTS) {
    familySet.add(font);
  }
  
  // Convert to arrays
  const families = Array.from(familySet).sort();
  const styles = new Map<string, string[]>();
  for (const [family, stylesSet] of stylesByFamily) {
    styles.set(family, Array.from(stylesSet).sort());
  }
  
  return { families, styles };
}

// Helper: Get nodes based on scope
function getNodesForScope(scope: ScanScope): SceneNode[] {
  switch (scope) {
    case 'selection':
      return [...figma.currentPage.selection];
    case 'page':
      return [...figma.currentPage.children];
    case 'document':
      // CRITICAL FIX: Only access currently loaded pages
      // Pages are loaded dynamically, so we can only safely access loaded pages
      const allNodes: SceneNode[] = [];
      // Only iterate through pages that are already loaded
      for (const page of figma.root.children) {
        // Check if page is loaded (has children property accessible)
        try {
          if (page.children) {
            allNodes.push(...page.children);
          }
        } catch (e) {
          // Page not loaded yet, skip it
          console.warn(`Page "${page.name}" is not loaded yet, skipping`);
        }
      }
      return allNodes;
  }
}

// Helper: Recursively find all text nodes (optimized with early termination option)
function findAllTextNodes(nodes: readonly SceneNode[]): TextNode[] {
  const textNodes: TextNode[] = [];
  const stack: SceneNode[] = [...nodes];
  
  while (stack.length > 0) {
    const node = stack.pop()!;
    
    // Skip locked nodes
    if (node.locked) continue;
    
    if (node.type === 'TEXT') {
      textNodes.push(node);
    } else if ('children' in node) {
      // Add children in reverse order so we process them in correct order
      for (let i = node.children.length - 1; i >= 0; i--) {
        stack.push(node.children[i]);
      }
    }
  }
  
  return textNodes;
}

// Helper: Get font ranges from a text node (optimized for mixed styles)
function getFontRanges(node: TextNode): FontRange[] {
  const ranges: FontRange[] = [];
  const fontName = node.fontName;
  
  if (fontName === figma.mixed) {
    // Optimize: group consecutive characters with same font
    const len = node.characters.length;
    if (len === 0) return ranges;
    
    let currentFont = node.getRangeFontName(0, 1) as FontName;
    let rangeStart = 0;
    
    for (let i = 1; i <= len; i++) {
      if (i === len) {
        // End of string, close current range
        ranges.push({ start: rangeStart, end: i, font: currentFont });
      } else {
        const font = node.getRangeFontName(i, i + 1) as FontName;
        if (font.family !== currentFont.family || font.style !== currentFont.style) {
          // Font changed, close current range and start new one
          ranges.push({ start: rangeStart, end: i, font: currentFont });
          currentFont = font;
          rangeStart = i;
        }
      }
    }
  } else {
    ranges.push({ start: 0, end: node.characters.length, font: fontName });
  }
  
  return ranges;
}

// Helper: Extract unique fonts from a text node
function extractFontsFromTextNode(node: TextNode): FontName[] {
  const fonts: FontName[] = [];
  const ranges = getFontRanges(node);
  
  for (const range of ranges) {
    const exists = fonts.some(f => f.family === range.font.family && f.style === range.font.style);
    if (!exists) {
      fonts.push(range.font);
    }
  }
  
  return fonts;
}

// Main: Scan for fonts
function scanFonts(scope: ScanScope): FontInfo[] {
  const nodes = getNodesForScope(scope);
  const textNodes = findAllTextNodes(nodes);
  
  // Count fonts (count actual font instances, not just text nodes)
  const fontMap = new Map<string, FontInfo>();
  
  for (const textNode of textNodes) {
    const ranges = getFontRanges(textNode);
    for (const range of ranges) {
      const key = `${range.font.family}|${range.font.style}`;
      const existing = fontMap.get(key);
      if (existing) {
        existing.count++;
      } else {
        fontMap.set(key, {
          family: range.font.family,
          style: range.font.style,
          count: 1
        });
      }
    }
  }
  
  // Convert to array and sort by family name
  return Array.from(fontMap.values()).sort((a, b) => 
    a.family.localeCompare(b.family) || a.style.localeCompare(b.style)
  );
}

// Main: Replace fonts (optimized with batch processing)
async function replaceFonts(
  scope: ScanScope, 
  mappings: FontMapping[]
): Promise<{ success: boolean; replaced: number; errors: string[] }> {
  const errors: string[] = [];
  let replaced = 0;
  
  if (mappings.length === 0) {
    return { success: true, replaced: 0, errors: [] };
  }
  
  // Create lookup map for fast matching
  const mappingMap = new Map<string, FontMapping>();
  for (const mapping of mappings) {
    mappingMap.set(`${mapping.oldFamily}|${mapping.oldStyle}`, mapping);
  }
  
  // Collect all fonts we need to load (both old and new)
  const fontsToLoad = new Set<string>();
  for (const mapping of mappings) {
    fontsToLoad.add(`${mapping.oldFamily}|${mapping.oldStyle}`);
    fontsToLoad.add(`${mapping.newFamily}|${mapping.newStyle}`);
  }
  
  // Load all fonts in parallel
  const loadPromises: Promise<void>[] = [];
  const fontLoadErrors = new Set<string>();
  
  for (const fontKey of fontsToLoad) {
    const [family, style] = fontKey.split('|');
    loadPromises.push(
      figma.loadFontAsync({ family, style }).catch((e) => {
        fontLoadErrors.add(fontKey);
        errors.push(`Could not load font: ${family} ${style}`);
      })
    );
  }
  await Promise.all(loadPromises);
  
  // Check if we had any loading errors for target fonts
  const criticalErrors = errors.filter(e => 
    mappings.some(m => {
      const newFontKey = `${m.newFamily}|${m.newStyle}`;
      return fontLoadErrors.has(newFontKey);
    })
  );
  if (criticalErrors.length > 0) {
    return { success: false, replaced: 0, errors: criticalErrors };
  }
  
  // Get nodes and text nodes
  const nodes = getNodesForScope(scope);
  const textNodes = findAllTextNodes(nodes);
  const totalNodes = textNodes.length;
  let processedNodes = 0;
  
  // Process in batches to avoid blocking
  const BATCH_SIZE = 50;
  
  for (let batchStart = 0; batchStart < totalNodes; batchStart += BATCH_SIZE) {
    const batchEnd = Math.min(batchStart + BATCH_SIZE, totalNodes);
    
    for (let i = batchStart; i < batchEnd; i++) {
      const textNode = textNodes[i];
      
      // Skip if node is locked or not editable
      if (textNode.locked) continue;
      
      try {
        const ranges = getFontRanges(textNode);
        
        // Check if any fonts in this node need replacement
        const hasReplacements = ranges.some(r => 
          mappingMap.has(`${r.font.family}|${r.font.style}`)
        );
        
        if (!hasReplacements) continue;
        
        // Process ranges in reverse order to avoid index shifts
        for (let j = ranges.length - 1; j >= 0; j--) {
          const range = ranges[j];
          const mapping = mappingMap.get(`${range.font.family}|${range.font.style}`);
          
          if (mapping) {
            try {
              // CRITICAL: Ensure the old font is loaded before modifying
              // (We already loaded it above, but double-check for safety)
              if (fontLoadErrors.has(`${range.font.family}|${range.font.style}`)) {
                continue; // Skip if old font couldn't be loaded
              }
              
              textNode.setRangeFontName(range.start, range.end, {
                family: mapping.newFamily,
                style: mapping.newStyle
              });
              replaced++;
            } catch (e) {
              // Continue processing other ranges
              errors.push(`Failed to replace font in "${textNode.name}": ${String(e)}`);
            }
          }
        }
      } catch (e) {
        // Node might have been deleted or become invalid
        errors.push(`Error processing node "${textNode.name}": ${String(e)}`);
      }
      
      processedNodes++;
    }
    
    // Send progress update
    if (totalNodes > BATCH_SIZE) {
      const progress = Math.round((processedNodes / totalNodes) * 100);
      figma.ui.postMessage({ type: 'progress', progress, total: totalNodes, processed: processedNodes });
    }
    
    // Yield to allow UI updates
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  
  return { success: errors.length === 0 || replaced > 0, replaced, errors };
}

// Helper: Select all text nodes with a specific font
function selectTextNodesWithFont(scope: ScanScope, family: string, style: string): number {
  const nodes = getNodesForScope(scope);
  const textNodes = findAllTextNodes(nodes);
  const matching: TextNode[] = [];
  
  for (const textNode of textNodes) {
    const fonts = extractFontsFromTextNode(textNode);
    if (fonts.some(f => f.family === family && f.style === style)) {
      matching.push(textNode);
    }
  }
  
  if (matching.length > 0) {
    figma.currentPage.selection = matching;
    figma.viewport.scrollAndZoomIntoView(matching);
  }
  
  return matching.length;
}

// Helper: Get all text styles in the document
interface TextStyleInfo {
  id: string;
  name: string;
  fontFamily: string;
  fontStyle: string;
  fontSize: number;
}

async function getTextStyles(): Promise<TextStyleInfo[]> {
  const styles = await figma.getLocalTextStylesAsync();
  return styles.map(s => ({
    id: s.id,
    name: s.name,
    fontFamily: s.fontName.family,
    fontStyle: s.fontName.style,
    fontSize: s.fontSize as number
  }));
}

// Helper: Find matching text style for a font
async function findMatchingTextStyle(family: string, style: string): Promise<TextStyleInfo | null> {
  const styles = await figma.getLocalTextStylesAsync();
  for (const s of styles) {
    if (s.fontName.family === family && s.fontName.style === style) {
      return {
        id: s.id,
        name: s.name,
        fontFamily: s.fontName.family,
        fontStyle: s.fontName.style,
        fontSize: s.fontSize as number
      };
    }
  }
  return null;
}

// Helper: Create a text style from a font
async function createTextStyle(family: string, style: string, name?: string): Promise<TextStyleInfo | null> {
  try {
    // Load the font first
    await figma.loadFontAsync({ family, style });
    
    const textStyle = figma.createTextStyle();
    textStyle.name = name || `${family} ${style}`;
    textStyle.fontName = { family, style };
    
    return {
      id: textStyle.id,
      name: textStyle.name,
      fontFamily: family,
      fontStyle: style,
      fontSize: textStyle.fontSize as number
    };
  } catch (e) {
    console.error('Failed to create text style:', e);
    return null;
  }
}

// Helper: Apply a text style to all text nodes with a specific font
async function applyTextStyle(
  scope: ScanScope, 
  styleId: string, 
  targetFamily: string, 
  targetStyle: string
): Promise<{ applied: number; errors: string[] }> {
  const errors: string[] = [];
  let applied = 0;
  
  const textStyle = figma.getStyleById(styleId);
  if (!textStyle || textStyle.type !== 'TEXT') {
    return { applied: 0, errors: ['Text style not found'] };
  }
  
  // Load the font from the style
  const styleFontName = (textStyle as TextStyle).fontName;
  try {
    await figma.loadFontAsync(styleFontName);
  } catch (e) {
    return { applied: 0, errors: [`Could not load font for style: ${styleFontName.family} ${styleFontName.style}`] };
  }
  
  // Also load the target font (needed to modify the text)
  try {
    await figma.loadFontAsync({ family: targetFamily, style: targetStyle });
  } catch (e) {
    return { applied: 0, errors: [`Could not load target font: ${targetFamily} ${targetStyle}`] };
  }
  
  const nodes = getNodesForScope(scope);
  const textNodes = findAllTextNodes(nodes);
  
  for (const textNode of textNodes) {
    if (textNode.locked) continue;
    
    try {
      const ranges = getFontRanges(textNode);
      
      // Check if this node has the target font
      const hasTarget = ranges.some(r => 
        r.font.family === targetFamily && r.font.style === targetStyle
      );
      
      if (!hasTarget) continue;
      
      // If the entire node uses this font, apply the style to the whole node
      if (textNode.fontName !== figma.mixed && 
          (textNode.fontName as FontName).family === targetFamily && 
          (textNode.fontName as FontName).style === targetStyle) {
        textNode.textStyleId = styleId;
        applied++;
      } else {
        // For mixed fonts, we can only apply to ranges (but styles apply to whole node)
        // So we'll apply to the whole node if majority uses target font
        const targetRanges = ranges.filter(r => 
          r.font.family === targetFamily && r.font.style === targetStyle
        );
        const totalChars = textNode.characters.length;
        const targetChars = targetRanges.reduce((sum, r) => sum + (r.end - r.start), 0);
        
        if (targetChars > totalChars / 2) {
          // More than half uses target font, apply style
          textNode.textStyleId = styleId;
          applied++;
        }
      }
    } catch (e) {
      errors.push(`Error applying style to "${textNode.name}": ${String(e)}`);
    }
  }
  
  return { applied, errors };
}

// Message handler
figma.ui.onmessage = async (msg) => {
  if (msg.type === 'select-font') {
    const { family, style, scope } = msg;
    try {
      const count = selectTextNodesWithFont(scope || 'page', family, style);
      figma.ui.postMessage({ type: 'select-result', count, family, style });
      if (count > 0) {
        figma.notify(`Selected ${count} text layer${count > 1 ? 's' : ''} with ${family} ${style}`);
      } else {
        figma.notify(`No text layers found with ${family} ${style}`);
      }
    } catch (e) {
      figma.notify('Error selecting text layers', { error: true });
    }
  }
  
  if (msg.type === 'get-text-styles') {
    try {
      const styles = await getTextStyles();
      figma.ui.postMessage({ type: 'text-styles-result', styles });
    } catch (e) {
      figma.ui.postMessage({ type: 'text-styles-error', error: String(e) });
    }
  }
  
  if (msg.type === 'find-matching-style') {
    const { family, style } = msg;
    try {
      const matchingStyle = await findMatchingTextStyle(family, style);
      figma.ui.postMessage({ type: 'matching-style-result', family, style, matchingStyle });
    } catch (e) {
      figma.ui.postMessage({ type: 'matching-style-error', error: String(e) });
    }
  }
  
  if (msg.type === 'create-text-style') {
    const { family, style, name } = msg;
    try {
      const newStyle = await createTextStyle(family, style, name);
      if (newStyle) {
        figma.ui.postMessage({ type: 'create-style-result', success: true, style: newStyle });
        figma.notify(`✓ Created text style "${newStyle.name}"`);
      } else {
        figma.ui.postMessage({ type: 'create-style-result', success: false, error: 'Failed to create style' });
        figma.notify('Failed to create text style', { error: true });
      }
    } catch (e) {
      figma.ui.postMessage({ type: 'create-style-result', success: false, error: String(e) });
      figma.notify('Error creating text style', { error: true });
    }
  }
  
  if (msg.type === 'apply-text-style') {
    const { styleId, targetFamily, targetStyle, scope } = msg;
    try {
      const result = await applyTextStyle(scope || 'page', styleId, targetFamily, targetStyle);
      figma.ui.postMessage({ type: 'apply-style-result', ...result });
      if (result.applied > 0) {
        figma.notify(`✓ Applied style to ${result.applied} text layer${result.applied > 1 ? 's' : ''}`);
      } else {
        figma.notify('No text layers were updated');
      }
    } catch (e) {
      figma.ui.postMessage({ type: 'apply-style-error', error: String(e) });
      figma.notify('Error applying text style', { error: true });
    }
  }
  
  if (msg.type === 'scan-fonts') {
    const scope: ScanScope = msg.scope || 'page';
    try {
      const fonts = scanFonts(scope);
      const { families, styles } = collectDocumentFonts();
      const textStyles = await getTextStyles();
      // Convert Map to object for postMessage
      const stylesObj: Record<string, string[]> = {};
      for (const [family, styleList] of styles) {
        stylesObj[family] = styleList;
      }
      figma.ui.postMessage({ 
        type: 'scan-result', 
        fonts, 
        scope,
        availableFonts: families,
        availableStyles: stylesObj,
        commonStyles: COMMON_STYLES,
        textStyles
      });
    } catch (e) {
      figma.ui.postMessage({ type: 'scan-error', error: String(e) });
      figma.notify('Error scanning fonts: ' + String(e), { error: true });
    }
  }
  
  if (msg.type === 'replace-fonts') {
    const scope: ScanScope = msg.scope || 'page';
    const mappings: FontMapping[] = msg.mappings || [];
    
    try {
      const result = await replaceFonts(scope, mappings);
      figma.ui.postMessage({ type: 'replace-result', ...result });
      
      if (result.success && result.replaced > 0) {
        figma.notify(`✓ Replaced fonts in ${result.replaced} text range(s)`);
      } else if (result.replaced === 0) {
        figma.notify('No fonts were replaced');
      } else {
        figma.notify(`⚠ Completed with errors: ${result.errors.slice(0, 3).join(', ')}${result.errors.length > 3 ? '...' : ''}`, { error: true });
      }
    } catch (e) {
      figma.ui.postMessage({ type: 'replace-error', error: String(e) });
      figma.notify('An error occurred during replacement', { error: true });
    }
  }
  
  if (msg.type === 'cancel') {
    figma.closePlugin();
  }
};

// Auto-scan on plugin open (with error handling)
setTimeout(async () => {
  try {
    const fonts = scanFonts('page');
    const { families, styles } = collectDocumentFonts();
    const textStyles = await getTextStyles();
    // Convert Map to object for postMessage
    const stylesObj: Record<string, string[]> = {};
    for (const [family, styleList] of styles) {
      stylesObj[family] = styleList;
    }
    figma.ui.postMessage({ 
      type: 'scan-result', 
      fonts, 
      scope: 'page',
      availableFonts: families,
      availableStyles: stylesObj,
      commonStyles: COMMON_STYLES,
      textStyles
    });
  } catch (e) {
    figma.ui.postMessage({ type: 'scan-error', error: String(e) });
  }
}, 100);
