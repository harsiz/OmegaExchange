// Local dev server — wraps the Vercel handler with a real HTTP listener
// Run: node api/server.js  (or: npm run api:dev)
import 'dotenv/config'
import app from './index.js'

const PORT = process.env.PORT || 3001
app.listen(PORT, () => {
  console.log(`[API] Dev server running on http://localhost:${PORT}`)
})
