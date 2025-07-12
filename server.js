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
    status: 'Universal Job Scraper API is running',
    node_version: process.version,
    platform: process.platform,
    memory: process.memoryUsage(),
    capabilities: [
      'Universal website scraping',
      'Keyword-based job detection',
      'Anti-bot protection bypass',
      'Flexible data extraction',
      'Multiple website support'
    ],
    endpoints: {
      scrape: 'POST /scrape - Scrape any website for job listings',
      bulk_scrape: 'POST /bulk-scrape - Scrape multiple websites',
      health: 'GET / - Health check'
    }
  });
});

// Single website scraping endpoint
app.post('/scrape', async (req, res) => {
  try {
    const { 
      url, 
      keywords = [], 
      selectors = {},
      limit = 20,
      waitTime = 3000,
      scrollPages = 1
    } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    console.log(`Starting scrape for: ${url} with keywords: ${keywords.join(', ')}`);
    
    const jobs = await scrapeWebsite({
      url,
      keywords,
      selectors,
      limit,
      waitTime,
      scrollPages
    });
    
    res.json({
      success: true,
      url,
      keywords,
      totalJobs: jobs.length,
      scrapedAt: new Date().toISOString(),
      jobs
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

// Bulk scraping endpoint for multiple websites
app.post('/bulk-scrape', async (req, res) => {
  try {
    const { websites = [] } = req.body;
    
    if (!websites.length) {
      return res.status(400).json({ error: 'Websites array is required' });
    }

    console.log(`Starting bulk scrape for ${websites.length} websites`);
    
    const results = [];
    
    for (const website of websites) {
      try {
        console.log(`Scraping: ${website.url}`);
        
        const jobs = await scrapeWebsite({
          url: website.url,
          keywords: website.keywords || [],
          selectors: website.selectors || {},
          limit: website.limit || 20,
          waitTime: website.waitTime || 3000,
          scrollPages: website.scrollPages || 1
        });
        
        results.push({
          success: true,
          url: website.url,
          keywords: website.keywords || [],
          totalJobs: jobs.length,
          jobs,
          scrapedAt: new Date().toISOString()
        });
        
        // Delay between websites to be respectful
        await randomDelay(2000, 5000);
        
      } catch (error) {
        console.error(`Error scraping ${website.url}:`, error);
        results.push({
          success: false,
          url: website.url,
          error: error.message,
          scrapedAt: new Date().toISOString()
        });
      }
    }
    
    res.json({
      success: true,
      totalWebsites: websites.length,
      successfulScrapes: results.filter(r => r.success).length,
      results
    });

  } catch (error) {
    console.error('Bulk scraping error:', error);
    res.status(500).json({ 
      error: 'Bulk scraping failed', 
      message: error.message 
    });
  }
});

async function scrapeWebsite({ url, keywords, selectors, limit, waitTime, scrollPages }) {
  let browser = null;
  
  try {
    console.log('Launching browser...');
    
    // Replace the puppeteer.launch() section with this:
browser = await puppeteer.launch({
  headless: 'new',
  executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium-browser',
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--disable-software-rasterizer',
    '--disable-dev-tools',
    '--no-first-run',
    '--no-default-browser-check',
    '--no-pings',
    '--single-process'
  ],
  timeout: 60000
});
    console.log('Browser launched successfully');
    const page = await browser.newPage();
    
    // Set realistic viewport and user agent
    await page.setViewport({ width: 1366, height: 768 });
    
    // Set additional headers to look more human
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

    // Override navigator properties to look more human
    await page.evaluateOnNewDocument(() => {
      // Remove webdriver property
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });
      
      // Override languages
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en']
      });
      
      // Override platform
      Object.defineProperty(navigator, 'platform', {
        get: () => 'Win32'
      });

      // Override plugins
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5]
      });

      // Override chrome object
      window.chrome = {
        runtime: {}
      };

      // Override permissions
      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters) => (
        parameters.name === 'notifications' ?
          Promise.resolve({ state: Notification.permission }) :
          originalQuery(parameters)
      );
    });

    console.log(`Navigating to: ${url}`);
    
    // Navigate to website
    await page.goto(url, { 
      waitUntil: 'domcontentloaded',
      timeout: 45000 
    });

    console.log('Page loaded, waiting for content...');

    // Wait for initial content to load
    await randomDelay(waitTime, waitTime + 2000);

    // Check if we got blocked
    const title = await page.title();
    console.log(`Page title: ${title}`);
    
    if (title.toLowerCase().includes('blocked') || 
        title.toLowerCase().includes('captcha') || 
        title.toLowerCase().includes('access denied') ||
        title.toLowerCase().includes('403') ||
        title.toLowerCase().includes('forbidden')) {
      throw new Error(`Blocked by website - Page title: ${title}`);
    }

    // Scroll through pages if specified
    for (let i = 0; i < scrollPages; i++) {
      if (i > 0) {
        console.log(`Scrolling page ${i + 1}...`);
        await page.evaluate(() => {
          window.scrollTo(0, document.body.scrollHeight);
        });
        await randomDelay(2000, 4000);
      }
    }

    // Extract job data using intelligent detection
    const jobs = await page.evaluate((keywords, selectors, limit, url) => {
      const extractedJobs = [];
      
      // Smart job detection - try multiple approaches
      const jobElements = findJobElements(selectors);
      
      console.log(`Found ${jobElements.length} potential job elements`);

      for (let i = 0; i < Math.min(jobElements.length, limit); i++) {
        const jobElement = jobElements[i];
        
        try {
          const job = extractJobData(jobElement, url, selectors);
          
          // Keyword filtering if keywords provided
          if (keywords.length > 0) {
            const jobText = `${job.title} ${job.description} ${job.company}`.toLowerCase();
            const hasKeyword = keywords.some(keyword => 
              jobText.includes(keyword.toLowerCase())
            );
            
            if (!hasKeyword) continue;
          }
          
          if (job.title && job.title.trim().length > 0) {
            extractedJobs.push(job);
          }
        } catch (error) {
          console.log('Error extracting job:', error);
        }
      }

      // Helper function to find job elements
      function findJobElements(customSelectors) {
        const selectors = [
          // Custom selectors first
          ...(customSelectors.jobContainer ? [customSelectors.jobContainer] : []),
          
          // Common job listing selectors
          '[data-jk]', // Indeed
          '.job_seen_beacon', // Indeed alternative
          '.job-card', // Generic
          '.job-item', // Generic
          '.job-listing', // Generic
          '.vacancy', // Generic
          '.position', // Generic
          '.career-item', // Career pages
          '.job-result', // Job boards
          '.opening', // Company pages
          '[class*="job"]', // Any class containing "job"
          '[class*="position"]', // Any class containing "position"
          '[class*="vacancy"]', // Any class containing "vacancy"
          '[class*="career"]', // Any class containing "career"
          'article', // Article elements (common for job posts)
          '.card', // Card layouts
          '.list-item', // List items
          '.row', // Bootstrap rows
          'tr', // Table rows
          'li' // List items
        ];
        
        let elements = [];
        
        for (const selector of selectors) {
          try {
            const found = Array.from(document.querySelectorAll(selector));
            if (found.length > 0) {
              console.log(`Found ${found.length} elements with selector: ${selector}`);
              
              // Filter elements that likely contain job data
              const filtered = found.filter(el => {
                const text = el.textContent.toLowerCase();
                const hasJobKeywords = /job|position|vacancy|career|hiring|employment|work|role|opportunity/.test(text);
                const hasMinContent = text.length > 50; // Minimum content length
                return hasJobKeywords && hasMinContent;
              });
              
              if (filtered.length > 0) {
                elements = filtered;
                break;
              }
            }
          } catch (e) {
            console.log(`Selector failed: ${selector}`, e);
          }
        }
        
        return elements;
      }

      // Helper function to extract job data from element
      function extractJobData(element, baseUrl, customSelectors) {
        const job = {
          title: '',
          company: '',
          location: '',
          salary: '',
          description: '',
          url: '',
          datePosted: '',
          jobId: '',
          scrapedAt: new Date().toISOString(),
          source: baseUrl
        };

        // Title extraction
        const titleSelectors = [
          customSelectors.title,
          'h1', 'h2', 'h3', 'h4',
          '[data-testid*="title"]',
          '[class*="title"]',
          '[class*="job-title"]',
          '[class*="position"]',
          'a[href*="job"]',
          '.job-link',
          'strong',
          '.name'
        ].filter(Boolean);
        
        job.title = getTextBySelectors(element, titleSelectors) || '';

        // Company extraction
        const companySelectors = [
          customSelectors.company,
          '[data-testid*="company"]',
          '[class*="company"]',
          '[class*="employer"]',
          '[class*="organization"]',
          '.company-name',
          '.employer',
          '.org'
        ].filter(Boolean);
        
        job.company = getTextBySelectors(element, companySelectors) || '';

        // Location extraction
        const locationSelectors = [
          customSelectors.location,
          '[data-testid*="location"]',
          '[class*="location"]',
          '[class*="city"]',
          '[class*="address"]',
          '.location',
          '.city',
          '.address'
        ].filter(Boolean);
        
        job.location = getTextBySelectors(element, locationSelectors) || '';

        // Salary extraction
        const salarySelectors = [
          customSelectors.salary,
          '[data-testid*="salary"]',
          '[class*="salary"]',
          '[class*="pay"]',
          '[class*="wage"]',
          '[class*="compensation"]',
          '.salary',
          '.pay',
          '.wage'
        ].filter(Boolean);
        
        job.salary = getTextBySelectors(element, salarySelectors) || '';

        // Description extraction
        const descriptionSelectors = [
          customSelectors.description,
          '[data-testid*="description"]',
          '[data-testid*="snippet"]',
          '[class*="description"]',
          '[class*="summary"]',
          '[class*="snippet"]',
          '.description',
          '.summary',
          '.snippet',
          'p'
        ].filter(Boolean);
        
        job.description = getTextBySelectors(element, descriptionSelectors) || '';

        // URL extraction
        const linkElement = element.querySelector('a[href]') || 
                            element.closest('a[href]') ||
                            element.querySelector('[href]');
        if (linkElement) {
          let href = linkElement.getAttribute('href');
          if (href) {
            if (href.startsWith('/')) {
              const baseUrlObj = new URL(baseUrl);
              href = `${baseUrlObj.protocol}//${baseUrlObj.host}${href}`;
            } else if (!href.startsWith('http')) {
              href = `${baseUrl}/${href}`;
            }
            job.url = href;
          }
        }

        // Date extraction
        const dateSelectors = [
          customSelectors.date,
          '[data-testid*="date"]',
          '[class*="date"]',
          '[class*="time"]',
          '[class*="posted"]',
          '.date',
          '.time',
          '.posted',
          'time'
        ].filter(Boolean);
        
        job.datePosted = getTextBySelectors(element, dateSelectors) || '';

        // Job ID extraction
        job.jobId = element.getAttribute('data-jk') || 
                   element.getAttribute('id') || 
                   element.getAttribute('data-id') ||
                   `job_${Math.random().toString(36).substr(2, 9)}`;

        // Clean up extracted data
        Object.keys(job).forEach(key => {
          if (typeof job[key] === 'string') {
            job[key] = job[key].trim().replace(/\s+/g, ' ');
            if (job[key].length > 500 && key === 'description') {
              job[key] = job[key].substring(0, 500) + '...';
            }
          }
        });

        return job;
      }

      // Helper function to try multiple selectors
      function getTextBySelectors(element, selectors) {
        for (const selector of selectors) {
          if (!selector) continue;
          
          try {
            const el = element.querySelector(selector);
            if (el) {
              return el.getAttribute('title') || 
                     el.getAttribute('aria-label') || 
                     el.textContent.trim();
            }
          } catch (e) {
            // Selector failed, try next
          }
        }
        return null;
      }

      return extractedJobs;
    }, keywords, selectors, limit, url);

    console.log(`Successfully scraped ${jobs.length} jobs from ${url}`);
    return jobs;

  } catch (error) {
    console.error('Error in scrapeWebsite:', error);
    throw error;
  } finally {
    if (browser) {
      console.log('Closing browser...');
      await browser.close();
    }
  }
}

// Helper function for random delays
function randomDelay(min, max) {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise(resolve => setTimeout(resolve, delay));
}

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  process.exit(0);
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Universal Job Scraper API running on port ${PORT}`);
  console.log(`Node.js version: ${process.version}`);
  console.log(`Platform: ${process.platform}`);
  console.log(`Memory: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);
});

module.exports = app;
