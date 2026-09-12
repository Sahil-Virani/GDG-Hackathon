Build a web app called "Outfit Rating Battle" — a round-based, multiplayer outfit-judging 
game for a hackathon demo. Prioritize a dark, neon/teal aesthetic with smooth micro-
animations throughout — this needs to feel like a game, not a utility app.

═══════════════════════════════════════════
CONCEPT
═══════════════════════════════════════════
Users join a video room and can optionally upload a "closet" of clothing item photos. 
A host sets the total number of rounds and a theme per round (e.g. "business casual," 
"date night"). All rounds except the final one are PRACTICE rounds meant purely for 
feedback and improvement — scores from practice rounds are shown but never carried 
forward. The FINAL round's scores are the only ones that determine the winner.

In every round, each user gets live, real-time pose guidance to help them frame 
themselves correctly before they even hit Ready. Once they hit Ready, a short countdown 
timer gives them a last chance to lock into position, after which a photo is 
automatically captured. That photo is scored by Gemini — and if Gemini itself flags the 
photo as unsuitable for confident scoring (bad angle, obstruction, not enough of the 
outfit visible), the user is sent back through the pose-guidance flow to retry, rather 
than being scored on a bad photo. Once everyone in the room has a valid, finalized photo 
for the round, the round's leaderboard reveals simultaneously to all participants, 
followed by personalized AI styling advice (using the user's closet when available) and 
an optional AI-generated preview of a suggested outfit swap. Then the next round begins. 
After the final round's advice step, results are locked in and the winner (based solely 
on final-round scores) is revealed with a podium celebration.

═══════════════════════════════════════════
TECH STACK
═══════════════════════════════════════════
- Frontend: React (Vite), Tailwind CSS, Framer Motion for animations
- Backend: Node.js + Express
- Video: Vonage Video API (OpenTok SDK) for multi-party video, Signal API for all 
  real-time sync (ready states, framing status, leaderboard reveals, reactions) — do 
  not stand up a separate WebSocket server
- Pose/framing detection: MediaPipe Pose (client-side, runs locally in-browser, no API 
  cost) — used both for continuous live guidance and for the post-timer validity check
- AI scoring + advice: Google Gemini API (vision-capable model)
- AI virtual try-on: Gemini 2.5 Flash Image (image editing model) for compositing a 
  suggested clothing item onto the user's captured photo — optional/best-effort feature 
  with a static-image fallback
- State: in-memory store on the backend (no database needed for a one-day demo)

═══════════════════════════════════════════
VISUAL DESIGN REQUIREMENTS
═══════════════════════════════════════════
- Dark background (near-black/deep navy) with teal/cyan neon accents
- Video tiles as rounded cards; border glow reflects that user's most recent round score
- Current round's leader gets a distinct crown/glow treatment (recalculated fresh each 
  round, since scores don't carry over)
- Leaderboard uses a glassmorphism panel style
- All state transitions (ready check-ins, countdown timer, score reveals, round 
  transitions) animate smoothly via Framer Motion
- Live pose-guidance overlay appears directly on the user's own video tile as friendly, 
  clear directional text/arrows ("Step back," "Move left," "Perfect — hold still")
- The countdown timer should be visually prominent (large animated number) since the 
  user needs to react to it physically
- Clearly visually distinguish PRACTICE rounds from the FINAL round in the UI (e.g. a 
  badge or banner reading "Practice Round 2 of 3" vs "FINAL ROUND")

═══════════════════════════════════════════
CORE FEATURES (build in this order)
═══════════════════════════════════════════

1. ROOM SETUP
   - Host creates a room, sets total number of rounds and the theme for each round 
     (can be set all upfront or per-round when reached)
   - Participants join via shared link/room code
   - Lobby screen shows connected participants and a closet upload option

2. CLOSET UPLOAD
   - Users can upload multiple clothing item photos, optionally tagged by category 
     (top, bottom, shoes, outerwear, accessory)
   - Stored per participant in backend room state as {imageData, category}
   - Optional — skipping just reduces personalization in the advice step later

3. CONTINUOUS LIVE POSE GUIDANCE (runs before Ready is even available)
   - Run MediaPipe Pose locally on each user's own video feed continuously
   - While a full body is not properly framed, show live directional feedback on their 
     tile: "Step back" (ankles not visible), "Move left"/"Move right" (shoulders 
     off-center), "Move closer" (person too small in frame)
   - When framing is good, show a clear positive indicator ("Looking good!") and enable 
     the Ready button
   - This guidance keeps running at all times a user isn't mid-countdown, including 
     after a failed attempt (see step 5)

4. READY-UP + COUNTDOWN TIMER
   - Once framing is good, the user can hit Ready
   - On click, start a visible countdown timer (configurable, default 7 seconds)
   - Live pose guidance continues to run during the countdown, since the user may drift 
     out of position
   - When the timer hits zero, check the MOST RECENT pose validity reading:
     a) If pose is currently invalid → do NOT capture or send anything. Show "Not quite 
        ready" and return the user to step 3 (live guidance) with the Ready button 
        available again, no limit on local retries since this costs nothing
     b) If pose is valid → capture a photo from their video feed and proceed to step 5

5. GEMINI SCORING WITH BUILT-IN QUALITY CHECK
   - POST the captured photo + round theme + participant ID to the backend
   - Backend calls Gemini using this prompt template:

   ---
   You are a fashion judge for a live outfit rating competition. You will be shown a 
   photo of one person's outfit. The competition theme is: "{{THEME}}"

   First, assess whether this photo is suitable for confident scoring. It is NOT 
   suitable if: the full outfit is not visible, the person is significantly cut off 
   or off-center, the image is too dark/blurry to judge clothing clearly, or a large 
   portion of the outfit is obstructed.

   If suitable, score the outfit using this rubric:
   - Theme relevance (0-4 points): How well does the outfit fit the specified theme?
   - Color coordination (0-3 points): Do the colors work well together?
   - Fit and styling (0-3 points): Does the outfit look intentional and well put-together?

   Total score is out of 10. Be decisive — use the full range, don't cluster around 6-7.

   Respond ONLY with valid JSON in exactly this format, no markdown, no code fences:

   {
     "photo_suitable": <true or false>,
     "reason_if_unsuitable": "<short reason, or empty string if suitable>",
     "score": <integer 0-10, or null if not suitable>,
     "feedback": "<one punchy sentence, judge-style, max 15 words, or empty if not suitable>",
     "breakdown": {
       "theme_relevance": <integer 0-4, or null>,
       "color_coordination": <integer 0-3, or null>,
       "fit_and_styling": <integer 0-3, or null>
     }
   }
   ---

   - Parse defensively (strip code fences, try/catch)
   - If "photo_suitable" is false → do NOT finalize a score for this participant this 
     round. Send them back to step 3 (live pose guidance) with a friendly message 
     surfacing the reason Gemini gave (e.g. "Let's try that again — [reason]"), and let 
     them go through Ready-up again
   - Cap retries at 3 attempts per participant per round to avoid a stuck loop; on the 
     3rd attempt, accept whatever Gemini returns even if flagged unsuitable, assigning 
     a fallback middle score (5) if score is null, so the game always progresses
   - If suitable, mark this participant as having a finalized score for the round

6. SIMULTANEOUS LEADERBOARD REVEAL (per round, not cumulative)
   - Once ALL participants have a finalized score for the round, broadcast the round's 
     leaderboard to everyone via Vonage Signal
   - Leaderboard shows per-user: photo thumbnail, this round's score, feedback line — 
     ranked highest to lowest for THIS ROUND ONLY
   - While waiting on others, show a "waiting on X, Y" indicator to those already done
   - Animate the reveal (count-up scores, crown for this round's leader)
   - Clearly label whether this is a practice round or the final round

7. POST-ROUND AI STYLING ADVICE
   - After reveal, call Gemini per participant with their photo, their score/feedback, 
     their closet (if uploaded), and the round's theme
   - Ask for specific improvement suggestions, prioritizing the user's own closet items 
     when relevant, general tips otherwise
   - Display as a personalized advice card visible only to that user

8. VIRTUAL TRY-ON PREVIEW (best-effort, build after 1-7 are solid)
   - "Show me" button on a suggested swap
   - Send the user's captured photo + suggested item image to Gemini's image editing 
     model to composite the item onto the person
   - FALLBACK REQUIRED: if generation fails or looks malformed, show the suggested item 
     as a static reference image instead — never block round progression on this

9. ROUND PROGRESSION
   - After advice (and optional try-on), each user hits "Ready for next round"
   - When all users are ready, advance the round counter, set the next theme, reset 
     per-round submission/retry tracking, and return everyone to step 3 for the new round
   - IMPORTANT: no scores carry over between rounds — each round's scoring is 
     independent and only exists to inform that round's leaderboard and advice

10. FINAL ROUND & RESULTS
    - When the round counter reaches the host-set total, that round is visually marked 
      "FINAL ROUND" throughout steps 3-7
    - After the final round's advice step (and/or try-on), instead of "next round," 
      show the final results screen using ONLY the final round's leaderboard — this is 
      the definitive winner, since all prior rounds were practice
    - Animate a podium reveal (1st/2nd/3rd) with confetti or similar celebratory effect, 
      clearly announcing the winner

11. LIVE REACTIONS (nice-to-have, build last)
    - Emoji reactions (🔥 💀 👑 😭) users can send that float briefly over another 
      participant's tile, via Vonage Signal, no backend state needed

═══════════════════════════════════════════
ERROR HANDLING REQUIREMENTS
═══════════════════════════════════════════
- Retry loop for unsuitable photos must be capped at 3 attempts per participant per 
  round to guarantee the game always progresses
- If Gemini fails entirely (network/timeout) rather than returning "unsuitable," retry 
  the call once, then fall back to a neutral score of 5 so one participant's API hiccup 
  doesn't stall the whole room
- If a participant disconnects mid-round, exclude them from "waiting on" counts and 
  round-completion checks
- MediaPipe live guidance should fail open after a few seconds of no valid pose reading 
  (let the user Ready up anyway with a warning) so a detection glitch never hard-blocks 
  someone from playing
- Virtual try-on failures must never block round progression — always fall back to the 
  static reference image

═══════════════════════════════════════════
DELIVERABLE
═══════════════════════════════════════════
A working local dev setup (npm install && npm run dev) with a clear .env.example for 
VONAGE_API_KEY, VONAGE_API_SECRET, and GEMINI_API_KEY. Keep the file structure simple 
and flat. Build and fully verify steps 1-7 and 9-10 (the complete core game loop across 
multiple rounds ending in a final-round-only winner) before spending any time on step 8 
(virtual try-on) or step 11 (reactions) — those are polish features that must never be 
allowed to jeopardize a working core demo.