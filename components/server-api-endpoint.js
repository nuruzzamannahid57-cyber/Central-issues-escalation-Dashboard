// Add this endpoint to your server.js in Central-issues-escalation-form repository

// Re-process issue endpoint - Re-escalates issue back to hub
app.patch('/api/issues/:id/reprocess', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { reprocessed_by, reprocessed_at } = req.body;

    // First, check if issue exists
    const checkResult = await pool.query(
      'SELECT * FROM issues WHERE id = $1',
      [id]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Issue not found' });
    }

    const issue = checkResult.rows[0];

    // Update issue status to "Open" and reset response status
    const updateResult = await pool.query(
      `UPDATE issues 
       SET status = 'Open',
           updated_at = $1,
           response_status = 'Need attention',
           remarks = CASE 
             WHEN remarks IS NULL OR remarks = '' THEN $3
             ELSE remarks || E'\n\n[Re-processed by ' || $4 || ' on ' || $5 || ']'
           END
       WHERE id = $2
       RETURNING *`,
      [
        reprocessed_at,
        id,
        `Re-processed by ${reprocessed_by} on ${new Date(reprocessed_at).toLocaleString()}`,
        reprocessed_by,
        new Date(reprocessed_at).toLocaleString()
      ]
    );

    // Optional: Log to history table if you have one
    try {
      await pool.query(
        `INSERT INTO issue_history (issue_id, action, user_email, timestamp, details) 
         VALUES ($1, $2, $3, $4, $5)`,
        [
          id,
          'Re-processed',
          reprocessed_by,
          reprocessed_at,
          `Issue re-escalated from status: ${issue.status}`
        ]
      );
    } catch (historyError) {
      console.warn('Could not log to history table:', historyError.message);
    }

    res.json({
      success: true,
      message: 'Issue successfully re-processed and escalated',
      issue: updateResult.rows[0]
    });

  } catch (error) {
    console.error('Re-process error:', error);
    res.status(500).json({
      error: 'Could not re-process issue',
      details: error.message
    });
  }
});