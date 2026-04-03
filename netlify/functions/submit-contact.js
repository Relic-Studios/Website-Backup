import { neon } from '@netlify/neon';

export default async (req, context) => {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    // Parse the request body
    const data = await req.json();

    // Validate required fields
    if (!data.name || !data.email || !data.message) {
      return new Response(JSON.stringify({
        error: 'Missing required fields: name, email, and message are required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Initialize Neon database connection
    // Automatically uses NETLIFY_DATABASE_URL environment variable
    const sql = neon();

    // Insert the contact form submission into the database
    const [submission] = await sql`
      INSERT INTO contact_submissions (
        name,
        email,
        phone,
        company,
        event_type,
        event_date,
        attendee_count,
        venue,
        budget,
        services,
        message,
        created_at
      ) VALUES (
        ${data.name},
        ${data.email},
        ${data.phone || null},
        ${data.company || null},
        ${data.eventType || null},
        ${data.eventDate || null},
        ${data.attendeeCount || null},
        ${data.venue || null},
        ${data.budget || null},
        ${data.services ? JSON.stringify(data.services) : null},
        ${data.message},
        NOW()
      )
      RETURNING id, created_at
    `;

    // Return success response
    return new Response(JSON.stringify({
      success: true,
      message: 'Your inquiry has been submitted successfully!',
      id: submission.id,
      timestamp: submission.created_at
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Database error:', error);

    // Return error response
    return new Response(JSON.stringify({
      error: 'Failed to submit form. Please try again later.',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const config = {
  path: "/api/submit-contact"
};
