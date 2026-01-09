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

// Helper: Get nodes based on scope
function getNodesForScope(scope: ScanScope): SceneNode[] {
  switch (scope) {
    case 'selection':
      return [...figma.currentPage.selection];
    case 'page':
      return [...figma.currentPage.children];
    case 'document':
      const allNodes: SceneNode[] = [];
      for (const page of figma.root.children) {
        allNodes.push(...page.children);
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
  
  // Count fonts (using text nodes, not character ranges for count)
  const fontMap = new Map<string, FontInfo>();
  
  for (const textNode of textNodes) {
    const fonts = extractFontsFromTextNode(textNode);
    for (const font of fonts) {
      const key = `${font.family}|${font.style}`;
      const existing = fontMap.get(key);
      if (existing) {
        existing.count++;
      } else {
        fontMap.set(key, {
          family: font.family,
          style: font.style,
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
  for (const fontKey of fontsToLoad) {
    const [family, style] = fontKey.split('|');
    loadPromises.push(
      figma.loadFontAsync({ family, style }).catch(() => {
        errors.push(`Could not load font: ${family} ${style}`);
      })
    );
  }
  await Promise.all(loadPromises);
  
  // Check if we had any loading errors for target fonts
  const criticalErrors = errors.filter(e => 
    mappings.some(m => e.includes(`${m.newFamily} ${m.newStyle}`))
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
            textNode.setRangeFontName(range.start, range.end, {
              family: mapping.newFamily,
              style: mapping.newStyle
            });
            replaced++;
          } catch (e) {
            // Continue processing other ranges
          }
        }
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
  
  return { success: errors.length === 0, replaced, errors };
}

// Message handler
figma.ui.onmessage = async (msg) => {
  if (msg.type === 'scan-fonts') {
    const scope: ScanScope = msg.scope || 'page';
    try {
      const fonts = scanFonts(scope);
      figma.ui.postMessage({ type: 'scan-result', fonts, scope });
    } catch (e) {
      figma.ui.postMessage({ type: 'scan-error', error: String(e) });
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
        figma.notify(`⚠ Completed with errors: ${result.errors.join(', ')}`, { error: true });
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

// Auto-scan on plugin open
setTimeout(() => {
  const fonts = scanFonts('page');
  figma.ui.postMessage({ type: 'scan-result', fonts, scope: 'page' });
}, 100);
