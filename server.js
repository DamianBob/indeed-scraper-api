const express = require('express');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

// Add stealth plugin to avoid detection
puppeteer.use(StealthPlugin());

const app = express();
app.use(express.json());

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ 
    status: 'Indeed Scraper API is running',
    endpoints: {
      scrape: 'POST /scrape - Scrape Indeed job listings',
      health: 'GET / - Health check'
    }
  });
});

// Main scraping endpoint
app.post('/scrape', async (req, res) => {
  try {
    const { keywords, location = 'United States', limit = 20 } = req.body;
    
    if (!keywords) {
      return res.status(400).json({ error: 'Keywords are required' });
    }

    console.log(`Starting scrape for: ${keywords} in ${location}`);
    
    const jobs = await scrapeIndeed(keywords, location, limit);
    
    res.json({
      success: true,
      keywords,
      location,
      totalJobs: jobs.length,
      jobs
    });

  } catch (error) {
    console.error('Scraping error:', error);
    res.status(500).json({ 
      error: 'Scraping failed', 
      message: error.message 
    });
  }
});

async function scrapeIndeed(keywords, location, limit) {
  let browser = null;
  
  try {
    // Launch browser with stealth configuration
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--window-size=1920,1080'
      ]
    });

    const page = await browser.newPage();
    
    // Set realistic viewport and user agent
    await page.setViewport({ width: 1920, height: 1080 });
    
    // Set additional headers to look more human
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
    });

    // Override navigator properties to look more human
    await page.evaluateOnNewDocument(() => {
      // Remove webdriver property
      delete navigator.__proto__.webdriver;
      
      // Override languages
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en']
      });
      
      // Override platform
      Object.defineProperty(navigator, 'platform', {
        get: () => 'Win32'
      });
    });

    // Build Indeed search URL
    const encodedKeywords = encodeURIComponent(keywords);
    const encodedLocation = encodeURIComponent(location);
    const searchUrl = `https://www.indeed.com/jobs?q=${encodedKeywords}&l=${encodedLocation}&sort=date`;
    
    console.log(`Navigating to: ${searchUrl}`);
    
    // Navigate to Indeed with realistic timing
    await page.goto(searchUrl, { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });

    // Random delay to appear more human
    await randomDelay(2000, 4000);

    // Check if we got blocked
    const title = await page.title();
    if (title.includes('blocked') || title.includes('captcha')) {
      throw new Error('Blocked by Indeed - may need to adjust approach');
    }

    // Wait for job listings to load
    await page.waitForSelector('[data-jk]', { timeout: 15000 });

    // Extract job data
    const jobs = await page.evaluate((limit) => {
      const jobElements = document.querySelectorAll('[data-jk]');
      const extractedJobs = [];

      for (let i = 0; i < Math.min(jobElements.length, limit); i++) {
        const jobElement = jobElements[i];
        
        try {
          // Extract job details
          const titleElement = jobElement.querySelector('h2 a span[title]');
          const companyElement = jobElement.querySelector('[data-testid="company-name"]');
          const locationElement = jobElement.querySelector('[data-testid="job-location"]');
          const salaryElement = jobElement.querySelector('[data-testid="attribute_snippet_testid"]');
          const summaryElement = jobElement.querySelector('[data-testid="job-snippet"]');
          const linkElement = jobElement.querySelector('h2 a');
          const dateElement = jobElement.querySelector('[data-testid="myJobsStateDate"]');

          // Build job object
          const job = {
            title: titleElement ? titleElement.getAttribute('title') : 'N/A',
            company: companyElement ? companyElement.textContent.trim() : 'N/A',
            location: locationElement ? locationElement.textContent.trim() : 'N/A',
            salary: salaryElement ? salaryElement.textContent.trim() : 'N/A',
            summary: summaryElement ? summaryElement.textContent.trim() : 'N/A',
            url: linkElement ? 'https://www.indeed.com' + linkElement.getAttribute('href') : 'N/A',
            datePosted: dateElement ? dateElement.textContent.trim() : 'N/A',
            jobId: jobElement.getAttribute('data-jk'),
            scrapedAt: new Date().toISOString()
          };

          // Only add jobs with valid titles
          if (job.title !== 'N/A' && job.title.length > 0) {
            extractedJobs.push(job);
          }
        } catch (error) {
          console.log('Error extracting job:', error);
        }
      }

      return extractedJobs;
    }, limit);

    console.log(`Successfully scraped ${jobs.length} jobs`);
    return jobs;

  } catch (error) {
    console.error('Error in scrapeIndeed:', error);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Helper function for random delays
function randomDelay(min, max) {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise(resolve => setTimeout(resolve, delay));
}

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Indeed Scraper API running on port ${PORT}`);
});

module.exports = app;