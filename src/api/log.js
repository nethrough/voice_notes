// File: /api/log.js
export default function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Only accept POST requests
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { event, data, timestamp } = req.body;

    // Basic validation
    if (!event || !timestamp) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    // Log the event (in production, you might send this to analytics services)
    console.log('Analytics Event:', {
      event,
      data: data || {},
      timestamp,
      userAgent: req.headers['user-agent'],
      ip: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
    });

    // In a real application, you might:
    // - Send to Google Analytics
    // - Store in a database
    // - Send to monitoring services like DataDog, New Relic, etc.
    // - Send to custom analytics platforms

    // Example of what you might do:
    // await sendToAnalytics({
    //   event,
    //   properties: data,
    //   timestamp,
    //   userId: getUserIdFromRequest(req),
    // });

    res.status(200).json({ 
      success: true, 
      message: 'Event logged successfully' 
    });
  } catch (error) {
    console.error('Error logging event:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}