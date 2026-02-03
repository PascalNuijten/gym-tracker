# Implementation Plan - Remaining Features

## ✅ COMPLETED
1. Bodyweight display (0kg → "Bodyweight")
2. Auto-copy set values when adding new set

## 🔄 IN PROGRESS - Implementing Now:

### 1. Chart Size (Simple)
- Change canvas height to 450px in styles.css

### 2. 4-Hour Routine Delay  
- Store `lastWorkoutTime` per category in routine memory
- Check if 4 hours (14400000ms) passed before regenerating
- Update in `generateWeeklyRoutine()` function

### 3. Record Popup
- Check if new session beats previous best (total volume)
- Calculate % increase
- Show modal with celebration

### 4. Smarter Performance %
- Current: Just compares max weight
- New: Calculate total volume (weight × reps × sets) per session
- Compare recent avg volume vs older avg volume
- Formula: ((recentVolume - oldVolume) / oldVolume) × 100

### 5. Separate Exercise Creation
- When creating NEW exercise, skip sets section
- Save exercise with empty history
- User then clicks "Log Workout" to add first session

### 6. Weekly Summary Redesign
- Remove average weight
- Add horizontal bar chart showing performance score over weeks
- Make scrollable for history
- Use Chart.js horizontal bar chart

## 🤖 AI FEASIBILITY ANALYSIS

### FREE & LIGHTWEIGHT Options:

**1. OpenAI GPT-4 API** 
- Cost: $0.03 per 1K tokens (input), $0.06 per 1K tokens (output)
- ~100 workout insights = $1-2/month
- ✅ Works with GitHub Pages (client-side API calls)
- Example: "Analyze my bench press trend and give suggestions"

**2. TensorFlow.js (100% FREE)**
- Runs entirely in browser
- No server needed
- Perfect for: Trend prediction, plateau detection
- ⚠️ Adds ~500KB to app size
- ✅ Works perfectly with GitHub Pages

**3. MediaPipe (100% FREE)**
- Google's pose detection library
- Client-side, no API costs
- Perfect for: Rep counting, form analysis
- ⚠️ Adds ~2MB to app size
- ✅ Works with GitHub Pages + camera access

**4. Web Speech API (100% FREE)**
- Built into browser
- No external dependencies
- Voice logging: "3 sets of 12 reps at 50kg"
- ✅ Perfect for GitHub Pages

### RECOMMENDED STARTER AI FEATURES:

**Phase 1 (Free, Easy):**
1. **Voice Logging** - Web Speech API
   - "Log 3 sets bench press 12 reps 50kg"
   - Parse with regex, no AI needed
   - Implementation time: 2-3 hours

2. **Simple Predictions** - TensorFlow.js
   - Linear regression for "when will I hit 100kg?"
   - Plateau detection
   - Implementation time: 4-6 hours

**Phase 2 (Paid but cheap):**
3. **AI Coach** - OpenAI API
   - Workout insights
   - Exercise form tips
   - Cost: ~$5/month for active use
   - Implementation time: 3-4 hours

**Phase 3 (Advanced, Free):**
4. **Rep Counter** - MediaPipe
   - Camera-based rep counting
   - Form analysis
   - Implementation time: 8-12 hours

### GITHUB PAGES COMPATIBILITY:
✅ **YES** - All AI features work with static GitHub Pages because:
- API calls happen from client browser
- No server-side code needed
- User's browser does all processing (TensorFlow.js, MediaPipe)
- API keys can be stored in Firebase Realtime Database or environment

### IMPLEMENTATION STRATEGY:
1. Start with **Voice Logging** (free, easy, immediate value)
2. Add **TensorFlow.js predictions** (free, impressive)
3. Test user engagement
4. If users love it, add **OpenAI Coach** ($5/month budget)
5. Advanced users get **MediaPipe rep counter**

### COST ESTIMATE:
- Voice + TensorFlow.js: $0/month ✅
- + OpenAI Coach: ~$5-10/month
- Total infrastructure: Still just Firebase free tier

**Bottom Line**: AI is totally doable, mostly free, and works perfectly with your GitHub Pages setup!
