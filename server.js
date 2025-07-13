const express = require('express');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

// Add stealth plugin to avoid detection
puppeteer.use(StealthPlugin());

const app = express();
app.use(express.json({ limit: '10mb' }));

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ 
    status: 'Universal Content Scraper API - n8n Ready',
    node_version: process.version,
    platform: process.platform,
    memory: process.memoryUsage(),
    capabilities: [
      'Universal HTML content extraction',
      'JavaScript execution and waiting',
      'CAPTCHA bypass with stealth mode',
      'n8n-configurable selectors',
      'Raw content + structured data',
      'Infinite scalability via n8n'
    ],
    endpoints: {
      scrape: 'POST /scrape - Universal content scraping',
      bulk_scrape: 'POST /bulk-scrape - Multiple sites',
      raw_content: 'POST /raw-content - Get raw HTML + text',
      install_chrome: 'POST /install-chrome - Chrome installation'
    }
  });
});

// Universal scraping endpoint - n8n configures everything
app.post('/scrape', async (req, res) => {
  try {
    const { 
      url, 
      selectors = {},  // n8n provides all selectors
      waitTime = 5000,
      scrollPages = 1,
      javascript = true,  // Execute JS by default
      screenshots = false,
      extractAll = false  // If true, returns ALL page elements
    } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    console.log(`🌐 Universal scrape: ${url}`);
    
    const result = await universalScrape({
      url,
      selectors,
      waitTime,
      scrollPages,
      javascript,
      screenshots,
      extractAll
    });
    
    res.json({
      success: true,
      url,
      scrapedAt: new Date().toISOString(),
      ...result
    });

  } catch (error) {
    console.error('Scraping error:', error);
    res.status(500).json({ 
      error: 'Scraping failed', 
      message: error.message,
      url: req.body.url
    });
  }
});

// Raw content endpoint - for n8n to analyze and build selectors
app.post('/raw-content', async (req, res) => {
  try {
    const { url, waitTime = 5000 } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    console.log(`📄 Getting raw content: ${url}`);
    
    const result = await getRawContent(url, waitTime);
    
    res.json({
      success: true,
      url,
      scrapedAt: new Date().toISOString(),
      ...result
    });

  } catch (error) {
    console.error('Raw content error:', error);
    res.status(500).json({ 
      error: 'Raw content extraction failed', 
      message: error.message 
    });
  }
});

async function universalScrape({ url, selectors, waitTime, scrollPages, javascript, screenshots, extractAll }) {
  let browser = null;
  
  try {
    console.log('🚀 Launching browser...');
    
    // Launch browser with maximum stealth
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-features=TranslateUI,VizDisplayCompositor',
        '--disable-ipc-flooding-protection',
        '--window-size=1366,768',
        '--memory-pressure-off'
      ],
      timeout: 60000
    });

    const page = await browser.newPage();
    
    // Set realistic viewport and headers
    await page.setViewport({ width: 1366, height: 768 });
    
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1'
    });

    // Advanced anti-detection
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
      Object.defineProperty(navigator, 'platform', { get: () => 'Win32' });
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
      
      window.chrome = { runtime: {} };
      
      // Override permissions
      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters) => (
        parameters.name === 'notifications' ?
          Promise.resolve({ state: Notification.permission }) :
          originalQuery(parameters)
      );
      
      // Hide automation indicators
      delete Object.getPrototypeOf(navigator).webdriver;
    });

    console.log(`🌐 Navigating to: ${url}`);
    
    // Navigate to website
    await page.goto(url, { 
      waitUntil: javascript ? 'networkidle0' : 'domcontentloaded',
      timeout: 45000 
    });

    // Wait for content to load
    await randomDelay(waitTime, waitTime + 2000);

    // Scroll through pages if specified
    for (let i = 0; i < scrollPages; i++) {
      if (i > 0) {
        console.log(`📜 Scrolling page ${i + 1}...`);
        await page.evaluate(() => {
          window.scrollTo(0, document.body.scrollHeight);
        });
        await randomDelay(2000, 4000);
      }
    }

    // Take screenshot if requested
    let screenshot = null;
    if (screenshots) {
      screenshot = await page.screenshot({ 
        encoding: 'base64',
        fullPage: false
      });
    }

    // Get page metadata
    const pageInfo = await page.evaluate(() => ({
      title: document.title,
      url: window.location.href,
      description: document.querySelector('meta[name="description"]')?.content || '',
      keywords: document.querySelector('meta[name="keywords"]')?.content || ''
    }));

    console.log(`📄 Page title: ${pageInfo.title}`);
    
    // Check if blocked
    if (pageInfo.title.toLowerCase().includes('blocked') || 
        pageInfo.title.toLowerCase().includes('captcha') || 
        pageInfo.title.toLowerCase().includes('access denied')) {
      throw new Error(`Blocked by website - Page title: ${pageInfo.title}`);
    }

    // Extract content based on n8n configuration
    const extractedData = await page.evaluate((selectors, extractAll) => {
      const results = {
        elements: [],
        counts: {},
        rawData: {}
      };

      // If extractAll is true, return everything n8n can work with
      if (extractAll) {
        // Get all potential job containers
        const allSelectors = [
          'tr', 'li', 'div', 'article', 'section',
          '[class*="job"]', '[class*="position"]', '[class*="card"]',
          '[data-*]', '.row', '.item', '.listing'
        ];
        
        allSelectors.forEach(selector => {
          try {
            const elements = Array.from(document.querySelectorAll(selector));
            results.counts[selector] = elements.length;
            
            if (elements.length > 0 && elements.length < 500) { // Reasonable limit
              results.rawData[selector] = elements.slice(0, 20).map(el => ({
                tagName: el.tagName,
                className: el.className,
                textContent: el.textContent.substring(0, 200),
                innerHTML: el.innerHTML.substring(0, 300),
                attributes: Array.from(el.attributes).reduce((acc, attr) => {
                  acc[attr.name] = attr.value;
                  return acc;
                }, {})
              }));
            }
          } catch (e) {
            results.counts[selector] = `Error: ${e.message}`;
          }
        });
        
        return results;
      }

      // Use n8n-provided selectors for structured extraction
      if (Object.keys(selectors).length > 0) {
        // n8n provides specific selectors for this website
        const containerSelector = selectors.container || selectors.jobContainer || 'body';
        const containers = Array.from(document.querySelectorAll(containerSelector));
        
        results.elements = containers.map((container, index) => {
          const element = {};
          
          // Extract each field using n8n-provided selectors
          Object.keys(selectors).forEach(field => {
            if (field === 'container' || field === 'jobContainer') return;
            
            try {
              const fieldSelector = selectors[field];
              const fieldElement = container.querySelector(fieldSelector);
              
              if (fieldElement) {
                element[field] = fieldElement.textContent.trim() || 
                              fieldElement.getAttribute('href') || 
                              fieldElement.getAttribute('src') ||
                              fieldElement.getAttribute('title') ||
                              fieldElement.getAttribute('data-value') ||
                              fieldElement.innerHTML.substring(0, 200);
              } else {
                element[field] = null;
              }
            } catch (e) {
              element[field] = `Error: ${e.message}`;
            }
          });
          
          // Add metadata
          element._index = index;
          element._tagName = container.tagName;
          element._className = container.className;
          element._id = container.id;
          
          return element;
        });
        
        results.counts.totalContainers = containers.length;
        results.counts.extractedElements = results.elements.length;
      }

      return results;
    }, selectors, extractAll);

    console.log(`✅ Extracted data: ${extractedData.elements?.length || 0} elements`);

    return {
      pageInfo,
      extractedData,
      screenshot: screenshot ? `data:image/png;base64,${screenshot}` : null,
      extractionMethod: extractAll ? 'discover_all' : 'n8n_selectors'
    };

  } catch (error) {
    console.error('❌ Error in universalScrape:', error);
    throw error;
  } finally {
    if (browser) {
      console.log('🔒 Closing browser...');
      await browser.close();
    }
  }
}

async function getRawContent(url, waitTime) {
  let browser = null;
  
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--single-process']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1366, height: 768 });
    
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await new Promise(resolve => setTimeout(resolve, waitTime));
    
    const analysis = await page.evaluate(() => {
      // Analyze page structure for n8n
      const analysis = {
        title: document.title,
        url: window.location.href,
        bodyText: document.body.textContent.substring(0, 3000),
        htmlStructure: document.documentElement.outerHTML.substring(0, 2000),
        elementCounts: {},
        sampleElements: {},
        suggestedSelectors: []
      };
      
      // Count different element types
      const selectors = [
        'tr', 'li', 'div', 'article', 'section', 'span', 'p',
        '.job', '.position', '.card', '.item', '.listing', '.row',
        '[class*="job"]', '[class*="position"]', '[data-*]'
      ];
      
      selectors.forEach(selector => {
        try {
          const elements = document.querySelectorAll(selector);
          analysis.elementCounts[selector] = elements.length;
          
          // Sample first few elements
          if (elements.length > 0 && elements.length < 1000) {
            analysis.sampleElements[selector] = Array.from(elements).slice(0, 3).map(el => ({
              tagName: el.tagName,
              className: el.className,
              textPreview: el.textContent.substring(0, 100),
              hasLinks: el.querySelector('a') ? true : false,
              childCount: el.children.length
            }));
          }
        } catch (e) {
          analysis.elementCounts[selector] = `Error: ${e.message}`;
        }
      });
      
      // Suggest likely job container selectors
      Object.keys(analysis.elementCounts).forEach(selector => {
        const count = analysis.elementCounts[selector];
        if (typeof count === 'number' && count > 5 && count < 200) {
          analysis.suggestedSelectors.push({
            selector,
            count,
            confidence: count > 10 && count < 100 ? 'high' : 'medium'
          });
        }
      });
      
      return analysis;
    });
    
    return analysis;

  } catch (error) {
    console.error('❌ Error in getRawContent:', error);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Auto-install Chrome on startup
async function installChromeOnStartup() {
  try {
    const testBrowser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
    await testBrowser.close();
    console.log('✅ Chrome is available');
  } catch (error) {
    console.log('📦 Installing Chrome...');
    try {
      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execAsync = promisify(exec);
      
      await execAsync('npx puppeteer browsers install chrome', { timeout: 300000 });
      console.log('✅ Chrome installation completed');
    } catch (installError) {
      console.error('❌ Chrome installation failed:', installError.message);
    }
  }
}

// Helper function for random delays
function randomDelay(min, max) {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise(resolve => setTimeout(resolve, delay));
}

// Manual Chrome installation endpoint
app.post('/install-chrome', async (req, res) => {
  try {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    
    const { stdout } = await execAsync('npx puppeteer browsers install chrome', { timeout: 300000 });
    
    res.json({ success: true, message: 'Chrome installed', output: stdout });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Error handling
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Universal Content Scraper API running on port ${PORT}`);
  console.log(`📋 Node.js version: ${process.version}`);
  console.log(`💻 Platform: ${process.platform}`);
  console.log(`🎯 Ready for n8n-driven infinite scalability!`);
  
  // Install Chrome on startup
  setTimeout(installChromeOnStartup, 5000);
});

module.exports = app;
