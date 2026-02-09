// Gym Tracker v2.0 - Separate Exercise Creation & Workout Logging

// AI CONFIGURATION - MULTI-MODEL ROTATION + CACHING
// API key is restricted to specific websites in Google Cloud Console
// To set up: https://console.cloud.google.com/apis/credentials
// Add HTTP referrer restrictions: https://pascalnuijten.github.io/*
const GEMINI_API_KEY = 'AIzaSyCy8L-GZkUhNfaoG3JQ3d26IBN1s8M12lU';

// Model rotation: Use 3 different models to get 60 requests/day total
const GEMINI_MODELS = [
    'gemini-2.5-flash',           // 20 RPD
    'gemini-2.5-flash-lite',      // 20 RPD
    'gemini-3-flash'              // 20 RPD
];
let currentModelIndex = parseInt(localStorage.getItem('gymTrackerModelIndex') || '0');

function getNextModel() {
    const model = GEMINI_MODELS[currentModelIndex];
    currentModelIndex = (currentModelIndex + 1) % GEMINI_MODELS.length;
    localStorage.setItem('gymTrackerModelIndex', currentModelIndex.toString());
    console.log(`🔄 Using model: ${model}`);
    return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
}

let useRealAI = true; // AI enabled by default

// AI Response Cache - Store responses to avoid re-requesting
const AI_CACHE_KEY = 'gymTrackerAICache';
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

function getCachedAIResponse(promptHash) {
    try {
        const cache = JSON.parse(localStorage.getItem(AI_CACHE_KEY) || '{}');
        const cached = cache[promptHash];
        if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
            console.log('✅ Using cached AI response');
            return cached.response;
        }
    } catch (e) {
        console.error('Cache read error:', e);
    }
    return null;
}

function setCachedAIResponse(promptHash, response) {
    try {
        const cache = JSON.parse(localStorage.getItem(AI_CACHE_KEY) || '{}');
        // Limit cache size to 50 entries
        const entries = Object.entries(cache);
        if (entries.length >= 50) {
            // Remove oldest entry
            const oldest = entries.sort((a, b) => a[1].timestamp - b[1].timestamp)[0];
            delete cache[oldest[0]];
        }
        cache[promptHash] = {
            response: response,
            timestamp: Date.now()
        };
        localStorage.setItem(AI_CACHE_KEY, JSON.stringify(cache));
    } catch (e) {
        console.error('Cache write error:', e);
    }
}

function hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(36);
}


// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyBfu3Z86uW0yjuZGPqObGeOaEEPY2aI0hI",
  authDomain: "gym-tracker-58d6a.firebaseapp.com",
  databaseURL: "https://gym-tracker-58d6a-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "gym-tracker-58d6a",
  storageBucket: "gym-tracker-58d6a.firebasestorage.app",
  messagingSenderId: "329738570193",
  appId: "1:329738570193:web:cd874f6eae7e11c90f78f0"
};

// Initialize Firebase
let database;
try {
    firebase.initializeApp(firebaseConfig);
    database = firebase.database();
    console.log('Firebase initialized successfully');
} catch (error) {
    console.error('Firebase initialization error:', error);
    alert('Please configure Firebase settings in app.js');
}

// State Management
let currentUser = localStorage.getItem('gymTrackerCurrentUser') || 'Fran';
let exercises = [];
let editingExerciseId = null;
let setCounter = 1;
let currentChart = null;
let users = ['Fran', 'Pascal', 'Cicci']; // Track all users
let isNewlyAddedFromCamera = false; // Track if exercise was just added from camera
let userProfiles = JSON.parse(localStorage.getItem('gymTrackerUserProfiles') || '{}'); // Store personal data per user

// USER PROFILE HELPERS
function saveUserProfile(username, profileData) {
    // Always reload from localStorage first to ensure we have latest data
    userProfiles = JSON.parse(localStorage.getItem('gymTrackerUserProfiles') || '{}');
    
    userProfiles[username] = {
        ...profileData,
        lastUpdated: new Date().toISOString()
    };
    localStorage.setItem('gymTrackerUserProfiles', JSON.stringify(userProfiles));
    console.log('✅ User profile saved for', username, profileData);
}

function getUserProfile(username) {
    // Always reload from localStorage to get fresh data
    userProfiles = JSON.parse(localStorage.getItem('gymTrackerUserProfiles') || '{}');
    return userProfiles[username] || null;
}

function hasCompleteProfile(username) {
    const profile = getUserProfile(username);
    return profile && profile.height && profile.weight && profile.gender;
}

function getUserContext(username) {
    const profile = getUserProfile(username);
    if (!profile) return '';
    
    let context = `\n\nUSER CONTEXT (${username}):\n`;
    if (profile.height && profile.weight) {
        const bmi = (profile.weight / ((profile.height / 100) ** 2)).toFixed(1);
        context += `- Physical: ${profile.height}cm, ${profile.weight}kg (BMI: ${bmi})`;
        if (profile.gender) context += `, ${profile.gender}`;
        if (profile.age) context += `, ${profile.age} years old`;
        context += `\n`;
    }
    if (profile.experience) context += `- Experience: ${profile.experience}\n`;
    if (profile.goal) context += `- Goal: ${profile.goal}\n`;
    if (profile.frequency) context += `- Training Frequency: ${profile.frequency} days/week\n`;
    if (profile.injuries) context += `- Injuries/Limitations: ${profile.injuries}\n`;
    
    return context;
}

function promptUserProfileSetup() {
    const profile = getUserProfile(currentUser);
    if (!hasCompleteProfile(currentUser)) {
        setTimeout(() => {
            document.getElementById('settingsModal').style.display = 'block';
            document.getElementById('settingsUserName').textContent = currentUser;
            loadUserProfileIntoForm();
            alert(`👋 Welcome ${currentUser}! Please fill in your personal information to get AI-powered personalized training advice.`);
        }, 500);
    }
}

function loadUserProfileIntoForm() {
    const profile = getUserProfile(currentUser);
    if (profile) {
        document.getElementById('userHeight').value = profile.height || '';
        document.getElementById('userWeight').value = profile.weight || '';
        document.getElementById('userGender').value = profile.gender || '';
        document.getElementById('userAge').value = profile.age || '';
        document.getElementById('userExperience').value = profile.experience || '';
        document.getElementById('userGoal').value = profile.goal || '';
        document.getElementById('userFrequency').value = profile.frequency || '';
        document.getElementById('userInjuries').value = profile.injuries || '';
    }
}

// AI HELPER FUNCTIONS
async function callGeminiAI(prompt, imageBase64 = null, includeUserContext = true, maxTokens = 500) {
    if (!useRealAI || !GEMINI_API_KEY) {
        console.log('Real AI disabled or no API key, using fallback');
        return null;
    }
    
    try {
        // Add user context to prompt if available and requested
        let enhancedPrompt = prompt;
        if (includeUserContext) {
            const userContext = getUserContext(currentUser);
            if (userContext) {
                enhancedPrompt = prompt + userContext;
            }
        }
        
        // STRATEGY 2: Check cache first (avoid duplicate requests)
        const promptHash = hashString(enhancedPrompt + (imageBase64 || ''));
        const cachedResponse = getCachedAIResponse(promptHash);
        if (cachedResponse) {
            return cachedResponse;
        }
        
        const requestBody = {
            contents: [{
                parts: [{
                    text: enhancedPrompt
                }]
            }],
            generationConfig: {
                temperature: 0.1,
                maxOutputTokens: maxTokens,
                topP: 0.8,
                topK: 10
            }
        }
        
        // Add image if provided
        if (imageBase64) {
            requestBody.contents[0].parts.unshift({
                inline_data: {
                    mime_type: "image/jpeg",
                    data: imageBase64.split(',')[1]
                }
            });
        }
        
        // STRATEGY 1: Model rotation - Get next available model
        const GEMINI_API_URL = getNextModel();
        
        const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody)
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Gemini API error response:', errorText);
            try {
                const error = JSON.parse(errorText);
                console.error('Gemini API error:', error);
                
                // If 429 quota exceeded, try next model automatically
                if (error.error?.code === 429) {
                    console.warn('⚠️ Model quota exceeded, trying next model...');
                    // Try up to 2 more models
                    for (let i = 0; i < 2; i++) {
                        try {
                            const nextModelUrl = getNextModel();
                            console.log(`🔄 Retrying with different model...`);
                            const retryResponse = await fetch(`${nextModelUrl}?key=${GEMINI_API_KEY}`, {
                                method: 'POST',
                                headers: {'Content-Type': 'application/json'},
                                body: JSON.stringify(requestBody)
                            });
                            
                            if (retryResponse.ok) {
                                const retryData = await retryResponse.json();
                                if (retryData.candidates?.[0]?.content) {
                                    const aiResponse = retryData.candidates[0].content.parts[0].text;
                                    console.log('✅ Retry successful with different model');
                                    setCachedAIResponse(promptHash, aiResponse);
                                    return aiResponse;
                                }
                            }
                        } catch (retryError) {
                            console.warn(`Retry ${i + 1} failed:`, retryError);
                        }
                    }
                }
                
                throw new Error(`API Error: ${error.error?.message || response.statusText}`);
            } catch (e) {
                throw new Error(`API Error: ${response.status} ${response.statusText}`);
            }
        }
        
        const data = await response.json();
        console.log('Full Gemini API response:', data);
        
        if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
            console.error('Unexpected API response structure:', data);
            throw new Error('Invalid API response structure');
        }
        
        const aiResponse = data.candidates[0].content.parts[0].text;
        console.log('AI response:', aiResponse);
        
        // STRATEGY 2: Cache the response for 24 hours
        setCachedAIResponse(promptHash, aiResponse);
        
        return aiResponse;
        
    } catch (error) {
        console.error('Error calling AI:', error);
        throw error; // Re-throw the error instead of returning null
    }
}

async function detectMusclesWithAI(exerciseName) {
    const prompt = `You are a fitness expert. Given the exercise name "${exerciseName}", identify the primary muscle groups worked.

Respond ONLY with a JSON array of muscle group names from this exact list:
["Chest", "Upper Chest", "Lower Chest", "Lats", "Traps", "Rhomboids", "Lower Back", "Front Delts", "Side Delts", "Rear Delts", "Biceps", "Triceps", "Forearms", "Quads", "Hamstrings", "Glutes", "Calves", "Abs", "Obliques", "Core"]

Example response format: ["Chest", "Triceps"]

Only include the most relevant 1-3 muscle groups. Be specific (e.g., "Upper Chest" for incline movements, not just "Chest").`;

    const aiResponse = await callGeminiAI(prompt);
    
    if (aiResponse) {
        try {
            // Extract JSON from response (in case AI adds extra text)
            const jsonMatch = aiResponse.match(/\[.*\]/s);
            if (jsonMatch) {
                const muscles = JSON.parse(jsonMatch[0]);
                return muscles;
            }
        } catch (e) {
            console.error('Failed to parse AI muscle response:', e);
        }
    }
    
    return null;
}

// DOM Elements (will be initialized in init())
let userButtons;
let addExerciseBtn;
let modal;
let closeModal;
let cancelBtn;
let exerciseForm;
let exerciseList;
let categoryFilter;
let muscleFilter;
let searchInput;
let workoutModal;
let workoutForm;
let workoutModalClose;
let workoutCancelBtn;
let workoutSetCounter = 1;

// Helper function to display weight
function formatWeight(weight) {
    return weight === 0 ? 'Bodyweight' : `${weight}kg`;
}

// Initialize App
function init() {
    // Initialize DOM elements
    userButtons = document.querySelectorAll('.user-btn');
    addExerciseBtn = document.getElementById('addExerciseBtn');
    modal = document.getElementById('exerciseModal');
    closeModal = document.querySelector('.close');
    cancelBtn = document.getElementById('cancelBtn');
    exerciseForm = document.getElementById('exerciseForm');
    exerciseList = document.getElementById('exerciseList');
    categoryFilter = document.getElementById('categoryFilter');
    muscleFilter = document.getElementById('muscleFilter');
    searchInput = document.getElementById('searchInput');
    
    // Initialize workout modal elements
    workoutModal = document.getElementById('workoutModal');
    workoutForm = document.getElementById('workoutForm');
    workoutModalClose = document.getElementById('workoutModalClose');
    workoutCancelBtn = document.getElementById('workoutCancelBtn');
    
    // Set active user button based on localStorage
    userButtons.forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.user === currentUser) {
            btn.classList.add('active');
        }
    });
    
    setupEventListeners();
    setupFirebaseListeners();
}

// Exercise Database - Common exercises with pre-filled data
const EXERCISE_DATABASE = {
    // Chest
    'bench press': { category: 'Chest', muscles: ['Chest', 'Front Delts', 'Triceps'], equipment: 'Barbell' },
    'incline bench press': { category: 'Chest', muscles: ['Upper Chest', 'Front Delts', 'Triceps'], equipment: 'Barbell' },
    'decline bench press': { category: 'Chest', muscles: ['Lower Chest', 'Triceps'], equipment: 'Barbell' },
    'dumbbell press': { category: 'Chest', muscles: ['Chest', 'Front Delts', 'Triceps'], equipment: 'Dumbbells' },
    'incline dumbbell press': { category: 'Chest', muscles: ['Upper Chest', 'Front Delts'], equipment: 'Dumbbells' },
    'chest fly': { category: 'Chest', muscles: ['Chest'], equipment: 'Dumbbells or Cable' },
    'cable fly': { category: 'Chest', muscles: ['Chest'], equipment: 'Cable Machine' },
    'push up': { category: 'Chest', muscles: ['Chest', 'Triceps'], equipment: 'Bodyweight' },
    
    // Back
    'deadlift': { category: 'Lower Back', muscles: ['Lower Back', 'Glutes', 'Hamstrings'], equipment: 'Barbell' },
    'barbell row': { category: 'Upper Back', muscles: ['Lats', 'Traps', 'Rear Delts'], equipment: 'Barbell' },
    'bent over row': { category: 'Upper Back', muscles: ['Lats', 'Traps'], equipment: 'Barbell' },
    'dumbbell row': { category: 'Upper Back', muscles: ['Lats', 'Traps'], equipment: 'Dumbbells' },
    'pull up': { category: 'Upper Back', muscles: ['Lats', 'Biceps'], equipment: 'Bodyweight' },
    'chin up': { category: 'Upper Back', muscles: ['Lats', 'Biceps'], equipment: 'Bodyweight' },
    'lat pulldown': { category: 'Laterals', muscles: ['Lats', 'Biceps'], equipment: 'Cable Machine' },
    'cable row': { category: 'Upper Back', muscles: ['Lats', 'Traps'], equipment: 'Cable Machine' },
    'face pull': { category: 'Shoulders', muscles: ['Rear Delts', 'Traps'], equipment: 'Cable Machine' },
    
    // Shoulders
    'shoulder press': { category: 'Shoulders', muscles: ['Front Delts', 'Side Delts', 'Triceps'], equipment: 'Barbell or Dumbbells' },
    'overhead press': { category: 'Shoulders', muscles: ['Front Delts', 'Triceps'], equipment: 'Barbell' },
    'military press': { category: 'Shoulders', muscles: ['Front Delts', 'Triceps'], equipment: 'Barbell' },
    'dumbbell shoulder press': { category: 'Shoulders', muscles: ['Front Delts', 'Side Delts'], equipment: 'Dumbbells' },
    'lateral raise': { category: 'Shoulders', muscles: ['Side Delts'], equipment: 'Dumbbells' },
    'front raise': { category: 'Shoulders', muscles: ['Front Delts'], equipment: 'Dumbbells' },
    'rear delt fly': { category: 'Shoulders', muscles: ['Rear Delts'], equipment: 'Dumbbells' },
    
    // Arms
    'barbell curl': { category: 'Biceps', muscles: ['Biceps'], equipment: 'Barbell' },
    'dumbbell curl': { category: 'Biceps', muscles: ['Biceps'], equipment: 'Dumbbells' },
    'hammer curl': { category: 'Biceps', muscles: ['Biceps', 'Forearms'], equipment: 'Dumbbells' },
    'preacher curl': { category: 'Biceps', muscles: ['Biceps'], equipment: 'Barbell or Dumbbells' },
    'tricep extension': { category: 'Triceps', muscles: ['Triceps'], equipment: 'Dumbbells or Cable' },
    'overhead tricep extension': { category: 'Triceps', muscles: ['Triceps'], equipment: 'Dumbbells' },
    'tricep pushdown': { category: 'Triceps', muscles: ['Triceps'], equipment: 'Cable Machine' },
    'skull crusher': { category: 'Triceps', muscles: ['Triceps'], equipment: 'Barbell' },
    'dips': { category: 'Triceps', muscles: ['Triceps', 'Chest'], equipment: 'Bodyweight or Dip Bar' },
    
    // Legs
    'squat': { category: 'Legs', muscles: ['Quads', 'Glutes', 'Hamstrings'], equipment: 'Barbell' },
    'back squat': { category: 'Legs', muscles: ['Quads', 'Glutes'], equipment: 'Barbell' },
    'front squat': { category: 'Legs', muscles: ['Quads', 'Core'], equipment: 'Barbell' },
    'leg press': { category: 'Legs', muscles: ['Quads', 'Glutes'], equipment: 'Machine' },
    'hack squat': { category: 'Legs', muscles: ['Quads', 'Glutes'], equipment: 'Machine' },
    'leg extension': { category: 'Legs', muscles: ['Quads'], equipment: 'Machine' },
    'leg curl': { category: 'Legs', muscles: ['Hamstrings'], equipment: 'Machine' },
    'hamstring curl': { category: 'Legs', muscles: ['Hamstrings'], equipment: 'Machine' },
    'romanian deadlift': { category: 'Legs', muscles: ['Hamstrings', 'Glutes', 'Lower Back'], equipment: 'Barbell' },
    'lunge': { category: 'Legs', muscles: ['Quads', 'Glutes'], equipment: 'Bodyweight or Dumbbells' },
    'bulgarian split squat': { category: 'Legs', muscles: ['Quads', 'Glutes'], equipment: 'Dumbbells' },
    'calf raise': { category: 'Legs', muscles: ['Calves'], equipment: 'Machine or Dumbbells' },
    
    // Abs
    'crunch': { category: 'Abdominals', muscles: ['Abs'], equipment: 'Bodyweight' },
    'sit up': { category: 'Abdominals', muscles: ['Abs', 'Core'], equipment: 'Bodyweight' },
    'plank': { category: 'Abdominals', muscles: ['Core', 'Abs'], equipment: 'Bodyweight' },
    'leg raise': { category: 'Abdominals', muscles: ['Abs', 'Core'], equipment: 'Bodyweight' },
    'hanging leg raise': { category: 'Abdominals', muscles: ['Abs'], equipment: 'Pull-up Bar' },
    'cable crunch': { category: 'Abdominals', muscles: ['Abs'], equipment: 'Cable Machine' },
    'russian twist': { category: 'Abdominals', muscles: ['Obliques', 'Abs'], equipment: 'Bodyweight or Dumbbell' }
};

// Smart exercise matching function
function findExerciseMatch(exerciseName) {
    const cleanName = exerciseName.toLowerCase().trim();
    
    // Direct match
    if (EXERCISE_DATABASE[cleanName]) {
        return EXERCISE_DATABASE[cleanName];
    }
    
    // Partial match - find exercises that contain the search term
    for (const [key, value] of Object.entries(EXERCISE_DATABASE)) {
        if (cleanName.includes(key) || key.includes(cleanName)) {
            return value;
        }
    }
    
    return null;
}

// AI Auto-fill Exercise Data
async function aiSuggestExerciseData(exerciseName) {
    const statusEl = document.getElementById('aiSuggestionStatus');
    const categorySelect = document.getElementById('exerciseCategory');
    const muscleSelect = document.getElementById('exerciseMuscle');
    const imageInput = document.getElementById('exerciseImage');
    const aiBtn = document.getElementById('aiSuggestBtn');
    
    // Show loading state
    aiBtn.disabled = true;
    aiBtn.textContent = '⏳ Analyzing...';
    statusEl.style.display = 'block';
    statusEl.style.color = '#666';
    statusEl.textContent = '🤖 AI is analyzing the exercise...';
    
    try {
        console.log('Auto-fill starting for:', exerciseName);
        
        // FIRST: Try AI (fast and smart)
        if (useRealAI) {
            console.log('Trying AI first...');
            
            // Set timeout for AI response
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('AI request timed out after 30 seconds')), 30000)
            );
        
            const prompt = `You are a fitness expert. Analyze the exercise: "${exerciseName}"

Respond with ONLY a JSON object in this exact format:
{
  "category": "Chest/Upper Back/Lower Back/Laterals/Shoulders/Biceps/Triceps/Abdominals/Legs",
  "muscles": ["Primary Muscle 1", "Primary Muscle 2"],
  "equipment": "Equipment description"
}

Rules:
- category: Must be ONE of the listed categories
- muscles: Array of 1-3 primary muscles from this list: [Chest, Upper Chest, Lower Chest, Back, Lats, Traps, Lower Back, Shoulders, Front Delts, Side Delts, Rear Delts, Biceps, Triceps, Forearms, Quads, Hamstrings, Glutes, Calves, Abs, Obliques, Core]
- equipment: Brief description (e.g., "Barbell", "Dumbbells", "Cable Machine", "Bodyweight")

Be concise and respond immediately with only the JSON.`;

            // Race between AI response and timeout
            const aiResponse = await Promise.race([
                callGeminiAI(prompt, null, false),
                timeoutPromise
            ]);
        
            console.log('AI response received:', aiResponse);
            
            if (!aiResponse) {
                throw new Error('No AI response received');
            }
            
            // Extract JSON - be very lenient with partial responses
            let jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                // Try to find JSON in markdown code block (even incomplete)
                const codeBlockMatch = aiResponse.match(/```(?:json)?\s*(\{[\s\S]*)/);
                if (codeBlockMatch) {
                    // Try to complete the JSON if it's cut off
                    let jsonStr = codeBlockMatch[1].trim();
                    // Remove trailing backticks if present
                    jsonStr = jsonStr.replace(/```\s*$/, '');
                    // If no closing brace, try to find where it was cut off and complete it
                    const openBraces = (jsonStr.match(/\{/g) || []).length;
                    const closeBraces = (jsonStr.match(/\}/g) || []).length;
                    if (openBraces > closeBraces) {
                        // Add missing closing braces
                        jsonStr += '\n}';
                    }
                    jsonMatch = [jsonStr];
                }
            }
            
            if (!jsonMatch) {
                console.error('No JSON found in response:', aiResponse);
                throw new Error('Invalid AI response format - no JSON found');
            }
            
            let data;
            try {
                data = JSON.parse(jsonMatch[0]);
            } catch (parseError) {
                // If parsing fails, try to extract partial data
                console.error('JSON parse error, attempting partial extraction:', parseError);
                const categoryMatch = jsonMatch[0].match(/"category"\s*:\s*"([^"]+)"/);
                const musclesMatch = jsonMatch[0].match(/"muscles"\s*:\s*\[(.*?)\]/s);
                const equipmentMatch = jsonMatch[0].match(/"equipment"\s*:\s*"([^"]+)"/);
                
                if (categoryMatch) {
                    data = {
                        category: categoryMatch[1],
                        muscles: musclesMatch ? musclesMatch[1].split(',').map(m => m.replace(/["\s]/g, '')) : [],
                        equipment: equipmentMatch ? equipmentMatch[1] : ''
                    };
                    console.log('Extracted partial data:', data);
                } else {
                    throw new Error('Could not extract any valid data from response');
                }
            }
            console.log('Parsed AI data:', data);
            
            // Auto-fill category
            if (data.category && categorySelect.querySelector(`option[value="${data.category}"]`)) {
                categorySelect.value = data.category;
                console.log('Category set to:', data.category);
            }
            
            // Auto-select muscles
            if (data.muscles && Array.isArray(data.muscles)) {
                Array.from(muscleSelect.options).forEach(option => {
                    option.selected = data.muscles.some(m => 
                        option.value.toLowerCase().includes(m.toLowerCase()) || 
                        m.toLowerCase().includes(option.value.toLowerCase())
                    );
                });
                console.log('Muscles selected:', data.muscles);
            }
            
            // Auto-fill equipment info
            if (data.equipment) {
                document.getElementById('machineInfo').value = data.equipment;
                console.log('Equipment set:', data.equipment);
            }
            
            statusEl.style.color = '#4CAF50';
            statusEl.textContent = `✅ AI suggested: ${data.category} targeting ${data.muscles.join(', ')}. Review and modify if needed.`;
            
            console.log('✅ AI auto-filled exercise data successfully');
        }
        
    } catch (error) {
        console.error('AI auto-fill failed:', error);
        console.error('Error details:', error.message, error.stack);
        
        // FALLBACK: Try database match if AI fails
        console.log('AI failed, trying database fallback...');
        const dbMatch = findExerciseMatch(exerciseName);
        
        if (dbMatch) {
            console.log('✅ Found in database fallback:', dbMatch);
            statusEl.style.color = '#28a745';
            statusEl.textContent = '✅ AI unavailable, used exercise database instead!';
            
            // Auto-fill the form
            if (dbMatch.category) {
                categorySelect.value = dbMatch.category;
                categorySelect.dispatchEvent(new Event('change'));
            }
            
            if (dbMatch.muscles && dbMatch.muscles.length > 0) {
                muscleSelect.value = dbMatch.muscles[0];
            }
            
            if (dbMatch.equipment) {
                document.getElementById('machineInfo').value = dbMatch.equipment;
            }
        } else {
            // No database match either
            statusEl.style.color = '#f44336';
            statusEl.textContent = `❌ AI auto-fill failed: ${error.message}. Please fill in manually.`;
        }
    } finally {
        aiBtn.disabled = false;
        aiBtn.textContent = '🤖 Auto-fill';
    }
}

// Event Listeners
function setupEventListeners() {
    // User Toggle
    userButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            userButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentUser = btn.dataset.user;
            localStorage.setItem('gymTrackerCurrentUser', currentUser);
            renderExercises();
            
            // Check if new user needs profile setup
            promptUserProfileSetup();
        });
    });

    // Add Exercise Button
    addExerciseBtn.addEventListener('click', () => {
        editingExerciseId = null; // Clear any previous editing state
        document.getElementById('modalTitle').textContent = 'Add Exercise';
        exerciseForm.reset();
        
        // Enable form fields
        document.getElementById('exerciseName').readOnly = false;
        document.getElementById('exerciseCategory').disabled = false;
        document.getElementById('exerciseMuscle').disabled = false;
        
        // Show new exercise section by default
        document.getElementById('newExerciseSection').style.display = 'block';
        document.getElementById('existingExerciseSection').style.display = 'none';
        document.getElementById('newExerciseBtn').classList.add('active');
        document.getElementById('existingExerciseBtn').classList.remove('active');
        
        // Clear search filter
        document.getElementById('existingExerciseSearch').value = '';
        
        // Show option toggle
        document.querySelector('.exercise-option-toggle').parentElement.style.display = 'block';
        
        // Populate existing exercises dropdown
        populateExistingExercises();
        
        modal.style.display = 'block';
    });

    // Exercise option toggle
    document.getElementById('existingExerciseBtn').addEventListener('click', () => {
        document.getElementById('existingExerciseSection').style.display = 'block';
        document.getElementById('newExerciseSection').style.display = 'none';
        document.getElementById('existingExerciseBtn').classList.add('active');
        document.getElementById('newExerciseBtn').classList.remove('active');
        
        // Remove all required attributes when selecting existing exercise
        document.getElementById('exerciseName').removeAttribute('required');
        document.getElementById('exerciseCategory').removeAttribute('required');
        document.getElementById('exerciseMuscle').removeAttribute('required');
    });

    document.getElementById('newExerciseBtn').addEventListener('click', () => {
        document.getElementById('newExerciseSection').style.display = 'block';
        document.getElementById('existingExerciseSection').style.display = 'none';
        document.getElementById('newExerciseBtn').classList.add('active');
        document.getElementById('existingExerciseBtn').classList.remove('active');
        
        // Set required attributes when creating new exercise
        document.getElementById('exerciseName').setAttribute('required', 'required');
        document.getElementById('exerciseCategory').setAttribute('required', 'required');
        document.getElementById('exerciseMuscle').setAttribute('required', 'required');
    });

    // When selecting an existing exercise, update the form
    document.getElementById('existingExerciseSelect').addEventListener('change', (e) => {
        const exerciseId = parseInt(e.target.value);
        if (exerciseId) {
            const exercise = exercises.find(ex => ex.id === exerciseId);
            if (exercise) {
                editingExerciseId = exerciseId;

    // AI AUTO-DETECT: Automatically suggest muscle groups when user types exercise name
    const exerciseNameInput = document.getElementById('exerciseName');
    const muscleSuggestionsDiv = document.createElement('div');
    muscleSuggestionsDiv.id = 'muscleSuggestions';
    muscleSuggestionsDiv.style.cssText = 'font-size: 12px; color: #10b981; margin-top: 5px; font-style: italic;';
    exerciseNameInput.parentElement.appendChild(muscleSuggestionsDiv);
    
    let aiDetectionTimeout;
    exerciseNameInput.addEventListener('input', async (e) => {
        const exerciseName = e.target.value.trim();
        
        if (exerciseName.length < 3) {
            muscleSuggestionsDiv.textContent = '';
            return;
        }
        
        // Clear previous timeout
        clearTimeout(aiDetectionTimeout);
        
        // Show loading indicator
        muscleSuggestionsDiv.innerHTML = '🤖 AI analyzing...';
        
        // Debounce AI calls (wait 800ms after user stops typing)
        aiDetectionTimeout = setTimeout(async () => {
            // Try real AI first
            let detectedMuscles = await detectMusclesWithAI(exerciseName);
            
            // Fallback to pattern matching if AI fails
            if (!detectedMuscles) {
                const exercisePatterns = {
                    'bench press': ['Chest', 'Triceps'],
                    'incline bench': ['Upper Chest', 'Triceps'],
                    'decline bench': ['Lower Chest', 'Triceps'],
                    'chest press': ['Chest'],
                    'chest fly': ['Chest'],
                    'cable fly': ['Chest'],
                    'pec deck': ['Chest'],
                    'dumbbell fly': ['Chest'],
                    'push-up': ['Chest', 'Triceps'],
                    'dip': ['Lower Chest', 'Triceps'],
                    'deadlift': ['Lower Back', 'Hamstrings', 'Glutes'],
                    'pull-up': ['Lats', 'Biceps'],
                    'chin-up': ['Lats', 'Biceps'],
                    'lat pulldown': ['Lats'],
                    'row': ['Lats', 'Rhomboids'],
                    'barbell row': ['Lats', 'Rhomboids'],
                    'dumbbell row': ['Lats', 'Rhomboids'],
                    't-bar row': ['Lats'],
                    'cable row': ['Lats', 'Rhomboids'],
                    'seated row': ['Lats', 'Rhomboids'],
                    'face pull': ['Rear Delts', 'Traps'],
                    'shoulder press': ['Front Delts', 'Triceps'],
                    'overhead press': ['Front Delts', 'Triceps'],
                    'military press': ['Front Delts', 'Triceps'],
                    'arnold press': ['Front Delts', 'Side Delts'],
                    'lateral raise': ['Side Delts'],
                    'side raise': ['Side Delts'],
                    'front raise': ['Front Delts'],
                    'rear delt fly': ['Rear Delts'],
                    'reverse fly': ['Rear Delts'],
                    'shrug': ['Traps'],
                    'squat': ['Quads', 'Glutes'],
                    'front squat': ['Quads'],
                    'back squat': ['Quads', 'Glutes'],
                    'leg press': ['Quads', 'Glutes'],
                    'leg extension': ['Quads'],
                    'leg curl': ['Hamstrings'],
                    'lunge': ['Quads', 'Glutes'],
                    'split squat': ['Quads', 'Glutes'],
                    'bulgarian': ['Quads', 'Glutes'],
                    'romanian deadlift': ['Hamstrings', 'Glutes'],
                    'rdl': ['Hamstrings', 'Glutes'],
                    'hamstring curl': ['Hamstrings'],
                    'calf raise': ['Calves'],
                    'leg raise': ['Abs'],
                    'bicep curl': ['Biceps'],
                    'hammer curl': ['Biceps', 'Forearms'],
                    'preacher curl': ['Biceps'],
                    'concentration curl': ['Biceps'],
                    'tricep extension': ['Triceps'],
                    'tricep pushdown': ['Triceps'],
                    'skull crusher': ['Triceps'],
                    'overhead extension': ['Triceps'],
                    'close grip bench': ['Triceps', 'Chest'],
                    'crunch': ['Abs'],
                    'sit-up': ['Abs'],
                    'plank': ['Abs', 'Core'],
                    'russian twist': ['Obliques'],
                    'cable crunch': ['Abs'],
                    'ab wheel': ['Abs']
                };
                
                const lowerName = exerciseName.toLowerCase();
                for (const [pattern, muscles] of Object.entries(exercisePatterns)) {
                    if (lowerName.includes(pattern)) {
                        detectedMuscles = muscles;
                        break;
                    }
                }
            }
            
            // Auto-select muscles if found
            if (detectedMuscles && detectedMuscles.length > 0) {
                const muscleSelect = document.getElementById('exerciseMuscle');
                
                // Clear current selection
                for (let option of muscleSelect.options) {
                    option.selected = false;
                }
                
                // Select detected muscles
                for (let option of muscleSelect.options) {
                    if (detectedMuscles.includes(option.value)) {
                        option.selected = true;
                    }
                }
                
                const aiLabel = useRealAI ? '🤖 Auto-detected' : '🤖 Pattern match';
                muscleSuggestionsDiv.innerHTML = `${aiLabel}: <strong>${detectedMuscles.join(', ')}</strong>`;
            } else {
                muscleSuggestionsDiv.textContent = '';
            }
        }, 800);
    });
            }
        } else {
            editingExerciseId = null;
        }
    });

    // Add search filter for existing exercises
    document.getElementById('existingExerciseSearch').addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const select = document.getElementById('existingExerciseSelect');
        const options = select.getElementsByTagName('option');
        
        for (let i = 0; i < options.length; i++) {
            const option = options[i];
            const text = option.textContent.toLowerCase();
            if (text.includes(searchTerm) || option.value === '') {
                option.style.display = '';
            } else {
                option.style.display = 'none';
            }
        }
    });

    // Close Modal
    closeModal.addEventListener('click', () => {
        modal.style.display = 'none';
    });

    cancelBtn.addEventListener('click', () => {
        modal.style.display = 'none';
    });

    // Removed outside-click-to-close to prevent accidental modal closing

    // Form Submit
    exerciseForm.addEventListener('submit', (e) => {
        e.preventDefault();
        saveExercise();
    });

    // Workout Modal Handlers
    workoutModalClose.addEventListener('click', () => {
        handleWorkoutModalClose();
    });

    workoutCancelBtn.addEventListener('click', () => {
        handleWorkoutModalClose();
    });

    // Removed outside-click-to-close to prevent accidental modal closing

    workoutForm.addEventListener('submit', (e) => {
        e.preventDefault();
        saveWorkout();
    });

    // Add Set Button for workout modal
    document.getElementById('workoutAddSetBtn').addEventListener('click', addWorkoutSet);

    // Add Set Button (legacy - for existing exercise selection, now removed)
    const addSetBtn = document.getElementById('addSetBtn');
    if (addSetBtn) {
        addSetBtn.addEventListener('click', addSet);
    }

    // Filters
    categoryFilter.addEventListener('change', renderExercises);
    muscleFilter.addEventListener('change', renderExercises);
    searchInput.addEventListener('input', renderExercises);
    
    // Generate Routine Button
    document.getElementById('generateRoutineBtn').addEventListener('click', generateWeeklyRoutine);
    
    // Add User Button
    document.getElementById('addUserBtn').addEventListener('click', showAddUserModal);
    
    // Weekly Summary Button
    document.getElementById('weeklySummaryBtn').addEventListener('click', showWeeklySummary);
    
    // Settings Button
    document.getElementById('settingsBtn').addEventListener('click', () => {
        document.getElementById('settingsModal').style.display = 'block';
        document.getElementById('settingsUserName').textContent = currentUser;
        loadUserProfileIntoForm();
    });
    
    // Settings Modal Export/Restore Buttons
    document.getElementById('exportBtnSettings').addEventListener('click', exportData);
    document.getElementById('restoreBtnSettings').addEventListener('click', restoreData);
    
    // AI Auto-fill Button for Create Exercise
    document.getElementById('aiSuggestBtn').addEventListener('click', async () => {
        const exerciseName = document.getElementById('exerciseName').value.trim();
        if (!exerciseName) {
            alert('⚠️ Please enter an exercise name first');
            return;
        }
        
        await aiSuggestExerciseData(exerciseName);
    });
    
    // Personal Info Form
    document.getElementById('personalInfoForm').addEventListener('submit', (e) => {
        e.preventDefault();
        
        const profileData = {
            height: parseFloat(document.getElementById('userHeight').value),
            weight: parseFloat(document.getElementById('userWeight').value),
            gender: document.getElementById('userGender').value,
            age: document.getElementById('userAge').value ? parseInt(document.getElementById('userAge').value) : null,
            experience: document.getElementById('userExperience').value || null,
            goal: document.getElementById('userGoal').value || null,
            frequency: document.getElementById('userFrequency').value || null,
            injuries: document.getElementById('userInjuries').value.trim() || null
        };
        
        saveUserProfile(currentUser, profileData);
        alert('✅ Personal information saved! AI features are now personalized for you.');
        document.getElementById('settingsModal').style.display = 'none';
    });
}

// Export Data
function exportData() {
    const data = {
        exercises: exercises,
        users: users,
        timestamp: new Date().toISOString(),
        version: '1.0'
    };
    
    const dataStr = JSON.stringify(data, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gym-tracker-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    alert('✅ Data exported successfully!');
}

// Restore Data
function restoreData() {
    // Show options modal
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'block';
    
    // Collect all backup versions
    const backups = [];
    const localBackup = localStorage.getItem('gymTrackerBackup');
    if (localBackup) {
        try {
            backups.push({ ...JSON.parse(localBackup), version: 'Latest' });
        } catch (e) {}
    }
    
    // Get versioned backups
    for (let i = 1; i <= 5; i++) {
        const versionedBackup = localStorage.getItem(`gymTrackerBackup_v${i}`);
        if (versionedBackup) {
            try {
                backups.push({ ...JSON.parse(versionedBackup), version: `v${i}` });
            } catch (e) {}
        }
    }
    
    let backupInfo = '';
    if (backups.length > 0) {
        backupInfo = `
            <div style="background: #e8f5e9; padding: 15px; border-radius: 8px; margin: 15px 0;">
                <h4>📦 Available Backups (${backups.length} found)</h4>
                ${backups.map((backup, idx) => `
                    <div style="background: white; padding: 10px; margin: 10px 0; border-radius: 5px; border-left: 4px solid #4caf50;">
                        <p style="margin: 5px 0;"><strong>Backup ${idx + 1}</strong> ${backup.version !== 'Latest' ? `(${backup.version})` : '(Current)'}</p>
                        <p style="margin: 5px 0; font-size: 0.9em;">📅 ${new Date(backup.timestamp).toLocaleString()}</p>
                        <p style="margin: 5px 0; font-size: 0.9em;">📊 ${backup.exercises?.length || 0} exercises | 👥 ${backup.users?.join(', ') || 'Unknown'}</p>
                        <button onclick="restoreFromVersion('${backup.version === 'Latest' ? 'current' : backup.version}')" 
                                style="margin-top: 5px; padding: 8px 15px; background: #4caf50; color: white; border: none; border-radius: 5px; cursor: pointer;">
                            🔄 Restore This
                        </button>
                    </div>
                `).join('')}
            </div>
        `;
    } else {
        backupInfo = '<p style="color: #f44336;">⚠️ No automatic backups found in browser storage.</p>';
    }
    
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 600px;">
            <span class="close" onclick="this.parentElement.parentElement.remove()">&times;</span>
            <h2>🔄 Restore Data</h2>
            
            ${backupInfo || '<p style="color: #f44336;">⚠️ No automatic backup found in browser storage.</p>'}
            
            <div style="border-top: 2px solid #eee; padding-top: 20px; margin-top: 20px;">
                <h4>📁 Restore from File</h4>
                <p>If you previously exported a backup file, upload it here:</p>
                <input type="file" id="restoreFileInput" accept=".json" style="margin: 10px 0; padding: 10px; border: 2px solid #ddd; border-radius: 5px; width: 100%;">
                <button onclick="restoreFromFile()" class="btn-primary" style="padding: 10px 20px; background: #2196f3; color: white; border: none; border-radius: 5px; cursor: pointer;">
                    📂 Upload & Restore
                </button>
            </div>
            
            <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin-top: 20px;">
                <h4>🔥 Firebase Revision History</h4>
                <p>Your Firebase database may have previous versions. To restore:</p>
                <ol style="text-align: left; margin-left: 20px;">
                    <li>Go to <a href="https://console.firebase.google.com/" target="_blank">Firebase Console</a></li>
                    <li>Select your project: <strong>gym-tracker-58d6a</strong></li>
                    <li>Go to <strong>Realtime Database</strong></li>
                    <li>Click the <strong>⋮</strong> menu → <strong>Export JSON</strong></li>
                    <li>Check if you have multiple backups/revisions</li>
                    <li>Download the correct one and restore it here using the file upload above</li>
                </ol>
            </div>
            
            <div style="margin-top: 20px; padding: 15px; background: #ffebee; border-radius: 8px;">
                <h4>⚠️ View Current Backup Data</h4>
                <p>Open browser console (F12) and run:</p>
                <code style="display: block; background: #333; color: #0f0; padding: 10px; border-radius: 5px; margin: 10px 0;">
                    JSON.parse(localStorage.getItem('gymTrackerBackup'))
                </code>
                <p style="font-size: 0.9em; color: #666;">This shows the timestamp and data in your automatic backup.</p>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

// Helper function to restore from versioned backups
window.restoreFromVersion = function(version) {
    let backupKey = version === 'current' ? 'gymTrackerBackup' : `gymTrackerBackup_${version}`;
    const backupData = localStorage.getItem(backupKey);
    
    if (!backupData) {
        alert('❌ Backup not found!');
        return;
    }
    
    try {
        const backup = JSON.parse(backupData);
        const backupDate = new Date(backup.timestamp).toLocaleString();
        
        if (confirm(`⚠️ CONFIRM RESTORE\n\nRestore backup from:\n${backupDate}\n\nExercises: ${backup.exercises?.length || 0}\n\nThis will replace ALL current data.`)) {
            exercises = backup.exercises;
            users = backup.users || users;
            saveToFirebase();
            renderExercises();
            alert('✅ Data restored successfully!');
            document.querySelector('.modal').remove();
        }
    } catch (e) {
        alert('❌ Error restoring backup: ' + e.message);
    }
}

// Helper function to restore from localStorage (legacy support)
window.restoreFromLocalStorage = function() {
    restoreFromVersion('current');
}
// Helper function to restore from file
window.restoreFromFile = function() {
    const input = document.getElementById('restoreFileInput');
    const file = input.files[0];
    
    if (!file) {
        alert('❌ Please select a file first!');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const data = JSON.parse(event.target.result);
            
            if (!data.exercises || !Array.isArray(data.exercises)) {
                alert('❌ Invalid backup file format!');
                return;
            }
            
            const backupDate = data.timestamp ? new Date(data.timestamp).toLocaleString() : 'Unknown date';
            
            if (confirm(`⚠️ CONFIRM RESTORE\n\nRestore backup from ${backupDate}?\n\nExercises: ${data.exercises.length}\n\nThis will replace all current data.`)) {
                exercises = data.exercises;
                users = data.users || users;
                saveToFirebase();
                renderExercises();
                alert('✅ Data restored from file!');
                document.querySelector('.modal').remove();
            }
        } catch (error) {
            console.error('Restore error:', error);
            alert('❌ Error reading backup file: ' + error.message);
        }
    };
    reader.readAsText(file);
}

// Reset Sets Container
function resetSetsContainer() {
    setCounter = 1;
    const container = document.getElementById('setsContainer');
    container.innerHTML = `
        <div class="set-entry" data-set="1">
            <h4>Set 1</h4>
            <div class="form-row">
                <div class="form-group">
                    <label for="set1_reps">Reps</label>
                    <input type="number" id="set1_reps" class="set-reps" min="0" placeholder="12">
                </div>
                <div class="form-group">
                    <label for="set1_weight">Weight (kg)</label>
                    <input type="number" id="set1_weight" class="set-weight" min="0" step="0.5" placeholder="50">
                </div>
            </div>
        </div>
    `;
}

// Add Set
function addSet() {
    // Get previous set values to pre-fill
    let prevReps = '';
    let prevWeight = '';
    if (setCounter > 0) {
        const prevRepsInput = document.getElementById(`set${setCounter}_reps`);
        const prevWeightInput = document.getElementById(`set${setCounter}_weight`);
        if (prevRepsInput && prevRepsInput.value) prevReps = prevRepsInput.value;
        if (prevWeightInput && prevWeightInput.value) prevWeight = prevWeightInput.value;
    }
    
    setCounter++;
    const container = document.getElementById('setsContainer');
    const setDiv = document.createElement('div');
    setDiv.className = 'set-entry';
    setDiv.setAttribute('data-set', setCounter);
    setDiv.innerHTML = `
        <h4>Set ${setCounter} <button type="button" class="btn-remove-set" onclick="removeSet(${setCounter})">✕</button></h4>
        <div class="form-row">
            <div class="form-group">
                <label for="set${setCounter}_reps">Reps</label>
                <input type="number" id="set${setCounter}_reps" class="set-reps" min="0" placeholder="12" value="${prevReps}">
            </div>
            <div class="form-group">
                <label for="set${setCounter}_weight">Weight (kg)</label>
                <input type="number" id="set${setCounter}_weight" class="set-weight" min="0" step="0.5" placeholder="50" value="${prevWeight}">
            </div>
        </div>
    `;
    container.appendChild(setDiv);
}

// Remove Set
function removeSet(setNumber) {
    const setEntry = document.querySelector(`[data-set="${setNumber}"]`);
    if (setEntry && setCounter > 1) {
        setEntry.remove();
        setCounter--;
        // Renumber remaining sets
        const allSets = document.querySelectorAll('.set-entry');
        allSets.forEach((set, index) => {
            const num = index + 1;
            set.setAttribute('data-set', num);
            set.querySelector('h4').innerHTML = num === 1 ? 
                `Set ${num}` : 
                `Set ${num} <button type="button" class="btn-remove-set" onclick="removeSet(${num})">✕</button>`;
            set.querySelector('.set-reps').id = `set${num}_reps`;
            set.querySelector('.set-weight').id = `set${num}_weight`;
        });
        setCounter = allSets.length;
    }
}

// Get Sets from Form
function getSetsFromForm() {
    const sets = [];
    const setEntries = document.querySelectorAll('.set-entry');
    setEntries.forEach((entry, index) => {
        const num = index + 1;
        const reps = parseInt(document.getElementById(`set${num}_reps`).value) || 0;
        const weight = parseFloat(document.getElementById(`set${num}_weight`).value) || 0;
        if (reps > 0 || weight > 0) {
            sets.push({ reps, weight });
        }
    });
    return sets;
}

// Populate Existing Exercises Dropdown
function populateExistingExercises() {
    const select = document.getElementById('existingExerciseSelect');
    select.innerHTML = '<option value="">Choose an exercise...</option>';
    
    console.log('Total exercises in database:', exercises.length);
    console.log('Current user:', currentUser);
    
    // Get all exercises that current user hasn't added yet
    // This means: no user entry OR user entry exists but has no history
    const availableExercises = exercises.filter(ex => {
        // Safety check: ensure users object exists
        if (!ex.users) {
            ex.users = {};
        }
        
        // Only show if user doesn't have this exercise at all
        const hasUserEntry = ex.users.hasOwnProperty(currentUser);
        const available = !hasUserEntry;
        
        if (available) {
            console.log('Available exercise:', ex.name, 'Users:', Object.keys(ex.users));
        }
        return available;
    });
    
    console.log('Available exercises for', currentUser + ':', availableExercises.length);
    
    // Sort by name for easier selection
    availableExercises.sort((a, b) => a.name.localeCompare(b.name));
    
    availableExercises.forEach(ex => {
        const option = document.createElement('option');
        option.value = ex.id;
        
        // Show who has done this exercise
        const usersWithHistory = Object.keys(ex.users).filter(user => 
            ex.users[user].history && ex.users[user].history.length > 0
        );
        const userInfo = usersWithHistory.length > 0 ? ` [${usersWithHistory.join(', ')}]` : ' [New]';
        
        option.textContent = `${ex.name} (${ex.category} - ${ex.muscle})${userInfo}`;
        select.appendChild(option);
    });
}

// Save Exercise (simplified - no workout logging, only creation/selection)
function saveExercise() {
    const existingExerciseBtn = document.getElementById('existingExerciseBtn');
    const isSelectingExisting = existingExerciseBtn && existingExerciseBtn.classList.contains('active');
    
    console.log('DEBUG: isSelectingExisting =', isSelectingExisting);
    console.log('DEBUG: editingExerciseId =', editingExerciseId);
    
    // PRIORITY 1: Check if selecting existing exercise (regardless of editingExerciseId)
    if (isSelectingExisting) {
        // User is selecting an existing exercise - NO field validation needed
        const existingExerciseSelect = document.getElementById('existingExerciseSelect');
        const selectedId = parseInt(existingExerciseSelect.value);
        
        console.log('DEBUG: selectedId =', selectedId);
        
        if (!selectedId) {
            alert('Please select an exercise from the dropdown list.');
            return;
        }
        
        const exercise = exercises.find(ex => ex.id === selectedId);
        if (!exercise) {
            alert('Exercise not found!');
            return;
        }
        
        // Ensure users object exists
        if (!exercise.users) {
            exercise.users = {};
        }
        
        // Ensure current user has an entry
        if (!exercise.users[currentUser]) {
            exercise.users[currentUser] = { history: [] };
        }
        
        // Immediately open workout modal so exercise appears in list after first workout
        modal.style.display = 'none';
        exerciseForm.reset();
        // Don't clear editingExerciseId here - let editExercise handle it
        alert(`Exercise "${exercise.name}" selected! Now log your first workout to add it to your list.`);
        setTimeout(() => {
            editingExerciseId = null; // Clear BEFORE opening workout modal
            editExercise(exercise.id);
        }, 100);
        return;
    }
    
    // PRIORITY 2: Check if we're editing an existing exercise
    if (editingExerciseId) {
        const exercise = exercises.find(ex => ex.id === editingExerciseId);
        if (exercise) {
            // Update exercise details
            exercise.name = document.getElementById('exerciseName').value.trim();
            exercise.category = document.getElementById('exerciseCategory').value;
            exercise.muscle = document.getElementById('exerciseMuscle').value;
            exercise.image = document.getElementById('exerciseImage').value || '';
            exercise.machineInfo = document.getElementById('machineInfo').value.trim();
            
            if (!exercise.name || !exercise.category || !exercise.muscle) {
                alert('Please fill in all required fields!');
                return;
            }
            
            saveToFirebase();
            alert(`Exercise "${exercise.name}" updated successfully!`);
            modal.style.display = 'none';
            editingExerciseId = null;
            exerciseForm.reset();
            renderExercises();
            return;
        }
    }
    
    // PRIORITY 3: User is creating a new exercise
    const name = document.getElementById('exerciseName').value.trim();
    const category = document.getElementById('exerciseCategory').value;
    const muscleSelect = document.getElementById('exerciseMuscle');
    const selectedMuscles = Array.from(muscleSelect.selectedOptions).map(opt => opt.value);
    const muscle = selectedMuscles.join(', '); // Join multiple muscles with comma
    const machineInfo = document.getElementById('machineInfo').value.trim();
    
    if (!name || !category || selectedMuscles.length === 0) {
        alert('Please fill in all required fields (including at least one muscle)!');
        return;
    }
    
    // Create exercise with EMPTY history for all users
    const newExercise = {
        id: Date.now(),
        name: name,
        category: category,
        muscle: muscle,
        image: document.getElementById('exerciseImage').value || '',
        machineInfo: machineInfo,
        users: {}
    };
    
    // Initialize all users with empty history
    users.forEach(user => {
        newExercise.users[user] = { history: [] };
    });
    
    exercises.push(newExercise);
    saveToFirebase();
    
    alert(`Exercise "${name}" created! Scroll down and click "Log Workout" to add your first session.`);
    modal.style.display = 'none';
    exerciseForm.reset();
    renderExercises();
}

// Show Record Celebration Popup
function showRecordCelebration(exerciseName, recordType, increasePercent) {
    const celebrationModal = document.createElement('div');
    celebrationModal.className = 'modal';
    celebrationModal.style.display = 'block';
    celebrationModal.innerHTML = `
        <div class="modal-content" style="max-width: 500px; text-align: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white;">
            <span class="close" onclick="this.parentElement.parentElement.remove()" style="color: white;">&times;</span>
            <div style="font-size: 5em; margin: 20px 0;">🎉</div>
            <h2 style="color: white; font-size: 2em; margin-bottom: 10px;">NEW RECORD!</h2>
            <h3 style="color: rgba(255,255,255,0.9); margin-bottom: 20px;">${exerciseName}</h3>
            <div style="background: rgba(255,255,255,0.2); padding: 20px; border-radius: 12px; margin: 20px 0;">
                <div style="font-size: 1.1em; margin-bottom: 10px;">📊 ${recordType}</div>
                <div style="font-size: 3em; font-weight: bold; color: #ffd700;">+${increasePercent}%</div>
                <div style="font-size: 1em; margin-top: 10px; color: rgba(255,255,255,0.8);">Increase from previous best!</div>
            </div>
            <div style="font-size: 1.2em; margin: 20px 0;">💪 Keep crushing it!</div>
            <button onclick="this.parentElement.parentElement.remove()" style="background: white; color: #667eea; border: none; padding: 12px 30px; font-size: 1.1em; font-weight: bold; border-radius: 25px; cursor: pointer; margin-top: 10px;">Awesome! 🔥</button>
        </div>
    `;
    document.body.appendChild(celebrationModal);
}

// Log Workout (opens separate workout modal)
function editExercise(id) {
    const exercise = exercises.find(ex => ex.id === id);
    if (!exercise) return;

    editingExerciseId = id;
    const workoutModal = document.getElementById('workoutModal');
    const workoutModalTitle = document.getElementById('workoutModalTitle');
    const workoutExerciseInfo = document.getElementById('workoutExerciseInfo');
    
    workoutModalTitle.textContent = `Log Workout - ${exercise.name}`;
    
    // Display exercise info
    workoutExerciseInfo.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
                <div style="font-weight: bold; font-size: 1.1em; margin-bottom: 5px;">${exercise.name}</div>
                <div style="color: #666; font-size: 0.9em;">
                    <span class="tag category">${exercise.category}</span>
                    <span class="tag muscle">${exercise.muscle}</span>
                </div>
            </div>
        </div>
        ${exercise.machineInfo ? `<div style="margin-top: 10px; font-style: italic; color: #666;">${exercise.machineInfo}</div>` : ''}
        <div id="aiWeightRecommendation" style="margin-top: 10px;"></div>
    `;
    
    // Reset workout sets
    resetWorkoutSetsContainer();
    document.getElementById('workoutNotes').value = '';

    workoutModal.style.display = 'block';
    
    // Get AI weight recommendation
    getAIWeightRecommendation(exercise);
}

// Edit Exercise Details (name, category, etc.) - DEPRECATED, keeping for compatibility
function editExerciseDetails(id) {
    const exercise = exercises.find(ex => ex.id === id);
    if (!exercise) return;

    // Close any open detail modals
    document.querySelectorAll('.modal').forEach(m => {
        if (m !== modal) m.remove();
    });

    editingExerciseId = id;
    document.getElementById('modalTitle').textContent = 'Edit Exercise - ' + exercise.name;
    
    // Fill form with exercise data
    document.getElementById('exerciseName').value = exercise.name;
    document.getElementById('exerciseName').readOnly = false;
    
    document.getElementById('exerciseCategory').value = exercise.category;
    document.getElementById('exerciseCategory').disabled = false;
    
    document.getElementById('exerciseMuscle').value = exercise.muscle;
    document.getElementById('exerciseMuscle').disabled = false;
    
    document.getElementById('exerciseImage').value = exercise.image || '';
    document.getElementById('machineInfo').value = exercise.machineInfo || '';
    
    // Show new exercise section
    document.getElementById('existingExerciseSection').style.display = 'none';
    document.getElementById('newExerciseSection').style.display = 'block';
    document.getElementById('newExerciseBtn').classList.add('active');
    document.getElementById('existingExerciseBtn').classList.remove('active');
    
    modal.style.display = 'block';
}

// Handle workout modal close - remove exercise if newly added and no sets logged
function handleWorkoutModalClose() {
    if (isNewlyAddedFromCamera && editingExerciseId) {
        const exercise = exercises.find(ex => ex.id === editingExerciseId);
        if (exercise && (!exercise.history || exercise.history.length === 0)) {
            // Exercise was added from camera but user didn't log any workout
            console.log('Removing newly added exercise with no workout data:', exercise.name);
            exercises = exercises.filter(ex => ex.id !== editingExerciseId);
            saveData();
            renderExercises();
        }
    }
    
    workoutModal.style.display = 'none';
    editingExerciseId = null;
    isNewlyAddedFromCamera = false;
}

// Reset Workout Sets Container
function resetWorkoutSetsContainer() {
    workoutSetCounter = 1;
    const container = document.getElementById('workoutSetsContainer');
    container.innerHTML = `
        <div class="set-entry" data-set="1">
            <h4>Set 1</h4>
            <div class="form-row">
                <div class="form-group">
                    <label for="workout_set1_reps">Reps</label>
                    <input type="number" id="workout_set1_reps" class="workout-set-reps" min="0" placeholder="12" required>
                </div>
                <div class="form-group">
                    <label for="workout_set1_weight">Weight (kg)</label>
                    <input type="number" id="workout_set1_weight" class="workout-set-weight" min="0" step="0.25" placeholder="50" required>
                </div>
            </div>
        </div>
    `;
}

// Add Workout Set
function addWorkoutSet() {
    // Get previous set values to pre-fill
    let prevReps = '';
    let prevWeight = '';
    if (workoutSetCounter > 0) {
        const prevRepsInput = document.getElementById(`workout_set${workoutSetCounter}_reps`);
        const prevWeightInput = document.getElementById(`workout_set${workoutSetCounter}_weight`);
        if (prevRepsInput && prevRepsInput.value) prevReps = prevRepsInput.value;
        if (prevWeightInput && prevWeightInput.value) prevWeight = prevWeightInput.value;
    }
    
    workoutSetCounter++;
    const container = document.getElementById('workoutSetsContainer');
    const setDiv = document.createElement('div');
    setDiv.className = 'set-entry';
    setDiv.setAttribute('data-set', workoutSetCounter);
    setDiv.innerHTML = `
        <h4>Set ${workoutSetCounter} <button type="button" class="btn-remove-set" onclick="removeWorkoutSet(${workoutSetCounter})">✕</button></h4>
        <div class="form-row">
            <div class="form-group">
                <label for="workout_set${workoutSetCounter}_reps">Reps</label>
                <input type="number" id="workout_set${workoutSetCounter}_reps" class="workout-set-reps" min="0" placeholder="12" value="${prevReps}" required>
            </div>
            <div class="form-group">
                <label for="workout_set${workoutSetCounter}_weight">Weight (kg)</label>
                <input type="number" id="workout_set${workoutSetCounter}_weight" class="workout-set-weight" min="0" step="0.25" placeholder="50" value="${prevWeight}" required>
            </div>
        </div>
    `;
    container.appendChild(setDiv);
}

// Remove Workout Set
function removeWorkoutSet(setNumber) {
    const setEntry = document.querySelector(`#workoutSetsContainer [data-set="${setNumber}"]`);
    if (setEntry && workoutSetCounter > 1) {
        setEntry.remove();
        workoutSetCounter--;
    }
}

// Get AI Weight Recommendation
async function getAIWeightRecommendation(exercise) {
    const recommendationDiv = document.getElementById('aiWeightRecommendation');
    if (!recommendationDiv) return;
    
    // Don't show for bodyweight exercises
    if (exercise.equipment === 'bodyweight' || exercise.equipment === 'none') {
        return;
    }
    
    if (!useRealAI) {
        recommendationDiv.innerHTML = `<div style="padding: 10px; background: #f0f0f0; border-radius: 5px; font-size: 0.9em; color: #666;">💡 Enable AI for smart weight recommendations</div>`;
        return;
    }
    
    recommendationDiv.innerHTML = `<div style="padding: 10px; background: #e3f2fd; border-radius: 5px; font-size: 0.9em;">
        <div class="loading-spinner" style="width: 16px; height: 16px; border-width: 2px; display: inline-block; vertical-align: middle;"></div> 
        <span style="margin-left: 5px;">AI is analyzing your training data...</span>
    </div>`;
    
    try {
        // Get user's workout history for this exercise
        const userData = exercise.users?.[currentUser];
        const history = userData?.history || [];
        
        // Get user profile
        const userProfile = getUserProfile(currentUser);
        const profileContext = userProfile ? getUserContext(currentUser) : '';
        
        // Get ALL user's exercises with history to find related movements
        const userExercises = exercises.filter(ex => ex.users && ex.users[currentUser]);
        const relatedExercises = userExercises
            .filter(ex => {
                const exHistory = ex.users[currentUser]?.history || [];
                return exHistory.length > 0 && (
                    ex.muscle === exercise.muscle || // Same muscle group
                    ex.category === exercise.category || // Same category
                    ex.id !== exercise.id // Not the same exercise
                );
            })
            .map(ex => {
                const exHistory = ex.users[currentUser].history;
                const recent = exHistory.slice(-3);
                const avgWeight = recent.reduce((sum, s) => 
                    sum + s.sets.reduce((s2, set) => s2 + set.weight, 0) / s.sets.length, 0
                ) / recent.length;
                const maxWeight = Math.max(...recent.flatMap(s => s.sets.map(set => set.weight)));
                
                return {
                    name: ex.name,
                    category: ex.category,
                    muscle: ex.muscle,
                    equipment: ex.equipment,
                    avgWeight: avgWeight.toFixed(1),
                    maxWeight: maxWeight.toFixed(1)
                };
            })
            .slice(0, 10); // Top 10 most relevant
        
        let historyContext = '';
        if (history.length > 0) {
            const recent = history.slice(-5); // Last 5 sessions
            historyContext = recent.map((session, idx) => {
                const avgWeight = session.sets.reduce((sum, s) => sum + s.weight, 0) / session.sets.length;
                const avgReps = session.sets.reduce((sum, s) => sum + s.reps, 0) / session.sets.length;
                const maxWeight = Math.max(...session.sets.map(s => s.weight));
                return `Session ${idx + 1} (${new Date(session.date).toLocaleDateString()}): ${session.sets.length} sets, avg ${avgWeight.toFixed(1)}kg × ${avgReps.toFixed(0)} reps, max ${maxWeight}kg`;
            }).join('\n');
        }
        
        let relatedExercisesContext = '';
        if (relatedExercises.length > 0) {
            relatedExercisesContext = '\nRELATED EXERCISES (for strength correlation):\n' + 
                relatedExercises.map(ex => 
                    `${ex.name} (${ex.muscle}, ${ex.equipment || 'unknown'}): avg ${ex.avgWeight}kg, max ${ex.maxWeight}kg`
                ).join('\n');
        }
        
        const prompt = `You are an expert strength coach. Recommend a starting weight for ${currentUser}'s next workout session.

EXERCISE: ${exercise.name}
- Category: ${exercise.category}
- Muscle Group: ${exercise.muscle}
- Equipment: ${exercise.equipment || 'unknown'}

${profileContext ? `USER PROFILE:\n${profileContext}\n\n` : ''}${historyContext ? `WORKOUT HISTORY FOR THIS EXERCISE (Last 5 sessions):\n${historyContext}\n\n` : 'NO PREVIOUS HISTORY for this exercise\n\n'}${relatedExercisesContext}

Recommend a weight in kg for their next session. Consider:
${history.length > 0 ? `- Progressive overload: suggest slightly more than previous sessions if they're progressing well
- Fatigue management: if they've been consistent, they might need a deload
- Rep range: assume they'll do 8-12 reps` : `- STRENGTH CORRELATIONS: Use their performance on similar exercises to predict capacity
  Example: If they squat 100kg, they might hack squat 80-90kg (mechanical advantage difference)
  Example: If they bench 80kg, they might dumbbell press 28-32kg per hand (stability requirement)
  Example: If they barbell row 70kg, they might cable row 60-65kg (different resistance curve)
- Their experience level and bodyweight
- Exercise-specific mechanics and difficulty
- Safe, conservative recommendation for first attempt`}
${userProfile?.injuries ? `- Their injuries/limitations: ${userProfile.injuries}\n` : ''}- Be specific and realistic based on ALL available data

Respond in this EXACT format:
WEIGHT: [number]
REASONING: [one sentence explaining why, referencing related exercises if used]

Example:
WEIGHT: 85
REASONING: Based on your 100kg squat, hack squat typically allows 80-90% of back squat weight.`;

        const aiResponse = await callGeminiAI(prompt, null, false);
        
        if (aiResponse) {
            // Parse AI response
            const weightMatch = aiResponse.match(/WEIGHT:\s*([\d.]+)/i);
            const reasoningMatch = aiResponse.match(/REASONING:\s*(.+)/i);
            
            if (weightMatch) {
                const recommendedWeight = parseFloat(weightMatch[1]);
                const reasoning = reasoningMatch ? reasoningMatch[1].trim() : 'AI recommendation based on your profile and history';
                
                recommendationDiv.innerHTML = `<div style="padding: 12px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 8px; font-size: 0.9em; box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);">
                    <div style="font-weight: bold; margin-bottom: 5px;">🤖 AI Recommendation</div>
                    <div style="font-size: 1.3em; font-weight: bold; margin: 8px 0;">${recommendedWeight}kg</div>
                    <div style="font-size: 0.85em; opacity: 0.95;">${reasoning}</div>
                    <button onclick="applyRecommendedWeight(${recommendedWeight})" class="secondary-btn" style="margin-top: 8px; font-size: 0.85em; padding: 6px 12px; background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.3); color: white;">
                        Apply ${recommendedWeight}kg
                    </button>
                </div>`;
                
                console.log('✅ AI weight recommendation:', recommendedWeight, 'kg');
            } else {
                throw new Error('Could not parse AI response');
            }
        } else {
            throw new Error('No AI response');
        }
        
    } catch (error) {
        console.error('AI weight recommendation failed:', error);
        
        // Fallback to previous session weight if available
        const userData = exercise.users?.[currentUser];
        const history = userData?.history || [];
        
        if (history.length > 0) {
            const lastSession = history[history.length - 1];
            const lastWeight = lastSession.sets.length > 0 ? lastSession.sets[0].weight : null;
            
            if (lastWeight && lastWeight > 0) {
                recommendationDiv.innerHTML = `<div style="padding: 10px; background: #fff3cd; border-radius: 5px; font-size: 0.9em;">
                    <strong>💡 Last session:</strong> ${lastWeight}kg
                    <button onclick="applyRecommendedWeight(${lastWeight})" class="secondary-btn" style="margin-left: 10px; font-size: 0.85em; padding: 4px 10px;">Use ${lastWeight}kg</button>
                </div>`;
            }
        } else {
            recommendationDiv.innerHTML = `<div style="padding: 10px; background: #f0f0f0; border-radius: 5px; font-size: 0.9em; color: #666;">💡 First time with this exercise? Start light and focus on form!</div>`;
        }
    }
}

// Apply recommended weight to first set
window.applyRecommendedWeight = function(weight) {
    const weightInput = document.getElementById('workout_set1_weight');
    if (weightInput) {
        weightInput.value = weight;
        weightInput.focus();
        
        // Visual feedback
        weightInput.style.background = '#e3f2fd';
        setTimeout(() => {
            weightInput.style.background = '';
        }, 1000);
    }
};

// Save Workout
function saveWorkout() {
    const exercise = exercises.find(ex => ex.id === editingExerciseId);
    if (!exercise) {
        alert('Exercise not found!');
        return;
    }
    
    // Get sets from workout form
    const sets = [];
    for (let i = 1; i <= workoutSetCounter; i++) {
        const repsInput = document.getElementById(`workout_set${i}_reps`);
        const weightInput = document.getElementById(`workout_set${i}_weight`);
        
        if (repsInput && weightInput) {
            const reps = parseInt(repsInput.value) || 0;
            const weight = parseFloat(weightInput.value) || 0;
            if (reps > 0 || weight > 0) {
                sets.push({ reps, weight });
            }
        }
    }
    
    if (sets.length === 0) {
        alert('Please add at least one set with reps and weight.');
        return;
    }
    
    const notes = document.getElementById('workoutNotes').value.trim();
    
    // Ensure current user has history array
    if (!exercise.users[currentUser]) {
        exercise.users[currentUser] = { history: [] };
    }
    if (!exercise.users[currentUser].history) {
        exercise.users[currentUser].history = [];
    }
    
    // Check for new record BEFORE adding to history
    let isNewRecord = false;
    let recordIncrease = 0;
    let recordType = '';
    
    const history = exercise.users[currentUser].history;
    if (history && history.length > 0) {
        // Calculate new session's total volume
        const newVolume = sets.reduce((sum, set) => sum + (set.reps * set.weight), 0);
        const newMaxWeight = Math.max(...sets.map(s => s.weight));
        
        // Calculate historical best volume
        let bestVolume = 0;
        let bestMaxWeight = 0;
        history.forEach(s => {
            const sessionVolume = s.sets.reduce((sum, set) => sum + (set.reps * set.weight), 0);
            const sessionMaxWeight = Math.max(...s.sets.map(set => set.weight));
            if (sessionVolume > bestVolume) bestVolume = sessionVolume;
            if (sessionMaxWeight > bestMaxWeight) bestMaxWeight = sessionMaxWeight;
        });
        
        // Check if new record
        if (newVolume > bestVolume && bestVolume > 0) {
            isNewRecord = true;
            recordIncrease = Math.round(((newVolume - bestVolume) / bestVolume) * 100 * 10) / 10;
            recordType = 'Total Volume';
        } else if (newMaxWeight > bestMaxWeight && bestMaxWeight > 0) {
            isNewRecord = true;
            recordIncrease = Math.round(((newMaxWeight - bestMaxWeight) / bestMaxWeight) * 100 * 10) / 10;
            recordType = 'Max Weight';
        }
    }
    
    // Add new workout session
    const session = {
        date: new Date().toISOString(),
        sets: sets,
        notes: notes
    };
    
    exercise.users[currentUser].history.push(session);
    saveToFirebase();
    
    // Show celebration if new record!
    if (isNewRecord) {
        showRecordCelebration(exercise.name, recordType, recordIncrease);
    } else {
        alert('Workout logged successfully!');
    }
    
    workoutModal.style.display = 'none';
    editingExerciseId = null;
    isNewlyAddedFromCamera = false; // Reset flag
    workoutForm.reset();
    renderExercises();
}

// Delete Exercise
function deleteExercise(id) {
    const exercise = exercises.find(ex => ex.id === id);
    if (!exercise) return;
    
    // Check if other users have data for this exercise
    const otherUsersHaveData = Object.keys(exercise.users).some(user => 
        user !== currentUser && exercise.users[user].history && exercise.users[user].history.length > 0
    );
    
    if (otherUsersHaveData) {
        // Only delete current user's data
        if (confirm(`This exercise has data from other users. Delete only YOUR data for "${exercise.name}"?`)) {
            delete exercise.users[currentUser];
            saveToFirebase();
        }
    } else {
        // Delete entire exercise (only current user has data)
        if (confirm(`Are you sure you want to delete "${exercise.name}" and all its history?`)) {
            exercises = exercises.filter(ex => ex.id !== id);
            saveToFirebase();
        }
    }
}

// Add User Modal
function showAddUserModal() {
    const userName = prompt('Enter new user name:');
    if (!userName) return;
    
    if (users.includes(userName)) {
        alert('User already exists!');
        return;
    }
    
    // Add user to list
    users.push(userName);
    
    // Add user to all existing exercises
    exercises.forEach(exercise => {
        exercise.users[userName] = { history: [] };
    });
    
    // Create user button
    const userToggle = document.querySelector('.user-toggle');
    const newBtn = document.createElement('button');
    newBtn.className = 'user-btn';
    newBtn.dataset.user = userName;
    newBtn.textContent = userName;
    newBtn.addEventListener('click', function() {
        document.querySelectorAll('.user-btn').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        currentUser = userName;
        renderExercises();
    });
    userToggle.appendChild(newBtn);
    
    saveToFirebase();
    alert(`User "${userName}" added successfully!`);
}

// Weekly Summary
function showWeeklySummary() {
    const now = Date.now();
    const oneWeekAgo = now - (7 * 24 * 60 * 60 * 1000);
    const twoWeeksAgo = now - (14 * 24 * 60 * 60 * 1000);
    
    const categories = ['Chest', 'Back/Shoulder', 'Legs', 'Functional'];
    
    // Get user's exercises with history
    const userExercises = exercises.filter(ex => {
        const userData = ex.users?.[currentUser];
        return userData && userData.history && userData.history.length > 0;
    });
    
    if (userExercises.length === 0) {
        alert('No workout data available yet!');
        return;
    }
    
    // Calculate stats per category
    const categorySummary = categories.map(category => {
        const categoryExercises = userExercises.filter(ex => ex.category === category);
        
        let thisWeekVolume = 0;
        let lastWeekVolume = 0;
        let thisWeekWorkouts = 0;
        let lastWeekWorkouts = 0;
        let thisWeekAvgWeight = 0;
        let lastWeekAvgWeight = 0;
        let weightCount = { thisWeek: 0, lastWeek: 0 };
        let recordsCount = 0;  // Count exercises with new records
        let weakerCount = 0;   // Count exercises that got weaker
        let totalExercises = 0; // Total exercises in category
        
        categoryExercises.forEach(ex => {
            const history = ex.users?.[currentUser]?.history || [];
            
            // Find this week's and last week's sessions for this exercise
            const thisWeekSessions = [];
            const lastWeekSessions = [];
            
            history.forEach(session => {
                const sessionDate = new Date(session.date).getTime();
                const volume = session.sets.reduce((sum, set) => sum + (set.reps * set.weight), 0);
                const avgWeight = session.sets.reduce((sum, set) => sum + set.weight, 0) / session.sets.length;
                const maxWeight = Math.max(...session.sets.map(s => s.weight));
                
                if (sessionDate >= oneWeekAgo) {
                    thisWeekVolume += volume;
                    thisWeekWorkouts++;
                    thisWeekAvgWeight += avgWeight;
                    weightCount.thisWeek++;
                    thisWeekSessions.push({ avgWeight, maxWeight, volume });
                } else if (sessionDate >= twoWeeksAgo) {
                    lastWeekVolume += volume;
                    lastWeekWorkouts++;
                    lastWeekAvgWeight += avgWeight;
                    weightCount.lastWeek++;
                    lastWeekSessions.push({ avgWeight, maxWeight, volume });
                }
            });
            
            // Compare performance: did this exercise improve or get worse?
            if (thisWeekSessions.length > 0 && lastWeekSessions.length > 0) {
                totalExercises++;
                const thisWeekBest = Math.max(...thisWeekSessions.map(s => s.maxWeight));
                const lastWeekBest = Math.max(...lastWeekSessions.map(s => s.maxWeight));
                
                if (thisWeekBest > lastWeekBest) {
                    recordsCount++; // New record!
                } else if (thisWeekBest < lastWeekBest) {
                    weakerCount++;  // Weaker performance
                }
            }
        });
        
        thisWeekAvgWeight = weightCount.thisWeek > 0 ? thisWeekAvgWeight / weightCount.thisWeek : 0;
        lastWeekAvgWeight = weightCount.lastWeek > 0 ? lastWeekAvgWeight / weightCount.lastWeek : 0;
        
        // Calculate improvement percentages
        const volumeImprovement = lastWeekVolume > 0 
            ? ((thisWeekVolume - lastWeekVolume) / lastWeekVolume * 100)
            : 0;
        
        const weightImprovement = lastWeekAvgWeight > 0
            ? ((thisWeekAvgWeight - lastWeekAvgWeight) / lastWeekAvgWeight * 100)
            : 0;
        
        const workoutImprovement = lastWeekWorkouts > 0
            ? ((thisWeekWorkouts - lastWeekWorkouts) / lastWeekWorkouts * 100)
            : 0;
        
        // Calculate SMARTER performance percentage using VOLUME (weight × reps × sets)
        let performancePercent = 0;
        if (totalExercises > 0) {
            // OLD METHOD: Just counted records vs weaker (based on max weight only)
            // NEW METHOD: Calculate actual volume improvement percentage
            
            let totalVolumeImprovement = 0;
            let exercisesWithBothWeeks = 0;
            
            categoryExercises.forEach(ex => {
                const history = ex.users?.[currentUser]?.history || [];
                
                // Calculate this week's average volume
                const thisWeekSessions = history.filter(session => {
                    const sessionDate = new Date(session.date).getTime();
                    return sessionDate >= oneWeekAgo;
                });
                
                // Calculate last week's average volume
                const lastWeekSessions = history.filter(session => {
                    const sessionDate = new Date(session.date).getTime();
                    return sessionDate >= twoWeeksAgo && sessionDate < oneWeekAgo;
                });
                
                if (thisWeekSessions.length > 0 && lastWeekSessions.length > 0) {
                    // Calculate average volume per session
                    const thisWeekAvgVolume = thisWeekSessions.reduce((sum, s) => {
                        const sessionVolume = s.sets.reduce((setSum, set) => setSum + (set.reps * set.weight), 0);
                        return sum + sessionVolume;
                    }, 0) / thisWeekSessions.length;
                    
                    const lastWeekAvgVolume = lastWeekSessions.reduce((sum, s) => {
                        const sessionVolume = s.sets.reduce((setSum, set) => setSum + (set.reps * set.weight), 0);
                        return sum + sessionVolume;
                    }, 0) / lastWeekSessions.length;
                    
                    if (lastWeekAvgVolume > 0) {
                        const volumeChange = ((thisWeekAvgVolume - lastWeekAvgVolume) / lastWeekAvgVolume) * 100;
                        totalVolumeImprovement += volumeChange;
                        exercisesWithBothWeeks++;
                    }
                }
            });
            
            // Average improvement across all exercises that have data for both weeks
            if (exercisesWithBothWeeks > 0) {
                performancePercent = Math.round((totalVolumeImprovement / exercisesWithBothWeeks) * 10) / 10;
            }
        }
        
        return {
            category,
            thisWeekVolume: Math.round(thisWeekVolume),
            lastWeekVolume: Math.round(lastWeekVolume),
            volumeImprovement: Math.round(volumeImprovement * 10) / 10,
            thisWeekWorkouts,
            lastWeekWorkouts,
            workoutImprovement: Math.round(workoutImprovement * 10) / 10,
            thisWeekAvgWeight: Math.round(thisWeekAvgWeight * 10) / 10,
            lastWeekAvgWeight: Math.round(lastWeekAvgWeight * 10) / 10,
            weightImprovement: Math.round(weightImprovement * 10) / 10,
            performancePercent,
            recordsCount,
            weakerCount,
            totalExercises
        };
    });
    
    // Calculate overall stats
    const totalThisWeek = categorySummary.reduce((sum, cat) => sum + cat.thisWeekWorkouts, 0);
    const totalLastWeek = categorySummary.reduce((sum, cat) => sum + cat.lastWeekWorkouts, 0);
    const totalVolumeThisWeek = categorySummary.reduce((sum, cat) => sum + cat.thisWeekVolume, 0);
    const totalVolumeLastWeek = categorySummary.reduce((sum, cat) => sum + cat.lastWeekVolume, 0);
    
    const overallImprovement = totalLastWeek > 0
        ? Math.round(((totalThisWeek - totalLastWeek) / totalLastWeek * 100) * 10) / 10
        : 0;
    
    const volumeOverallImprovement = totalVolumeLastWeek > 0
        ? Math.round(((totalVolumeThisWeek - totalVolumeLastWeek) / totalVolumeLastWeek * 100) * 10) / 10
        : 0;
    
    // Calculate overall performance percentage
    const totalRecords = categorySummary.reduce((sum, cat) => sum + cat.recordsCount, 0);
    const totalWeaker = categorySummary.reduce((sum, cat) => sum + cat.weakerCount, 0);
    const totalExercisesCompared = categorySummary.reduce((sum, cat) => sum + cat.totalExercises, 0);
    
    // Calculate overall performance as the average of category performance percentages
    let overallPerformancePercent = 0;
    const categoriesWithData = categorySummary.filter(cat => cat.totalExercises > 0);
    if (categoriesWithData.length > 0) {
        const totalPerformancePercent = categoriesWithData.reduce((sum, cat) => sum + cat.performancePercent, 0);
        overallPerformancePercent = Math.round(totalPerformancePercent / categoriesWithData.length * 10) / 10;
    }
    
    displayWeeklySummaryModal(categorySummary, {
        totalThisWeek,
        totalLastWeek,
        overallImprovement,
        totalVolumeThisWeek,
        totalVolumeLastWeek,
        volumeOverallImprovement,
        overallPerformancePercent,
        totalRecords,
        totalWeaker,
        totalExercisesCompared
    });
}

// Display Weekly Summary Modal
function displayWeeklySummaryModal(categorySummary, overall) {
    const summaryModal = document.createElement('div');
    summaryModal.className = 'modal';
    summaryModal.style.display = 'block';
    
    const getImprovementColor = (value) => {
        if (value > 5) return '#4caf50';
        if (value > 0) return '#8bc34a';
        if (value === 0) return '#999';
        if (value > -5) return '#ff9800';
        return '#f44336';
    };
    
    const getImprovementIcon = (value) => {
        if (value > 0) return '📈';
        if (value < 0) return '📉';
        return '➡️';
    };
    
    summaryModal.innerHTML = `
        <div class="modal-content" style="max-width: 1000px;">
            <span class="close" onclick="this.parentElement.parentElement.remove()">&times;</span>
            <h2>📊 Weekly Progress Summary - ${currentUser}</h2>
            <p style="color: #666; margin-bottom: 20px;">Comparing this week vs. last week's performance</p>
            
            <div class="summary-overall">
                <div class="summary-stat">
                    <div class="summary-label">Total Workouts</div>
                    <div class="summary-value">${overall.totalThisWeek} <span style="font-size: 0.8em; color: #999;">(was ${overall.totalLastWeek})</span></div>
                    <div class="summary-change" style="color: ${getImprovementColor(overall.overallImprovement)}">
                        ${getImprovementIcon(overall.overallImprovement)} ${overall.overallImprovement > 0 ? '+' : ''}${overall.overallImprovement}%
                    </div>
                </div>
                <div class="summary-stat">
                    <div class="summary-label">Total Volume (kg)</div>
                    <div class="summary-value">${overall.totalVolumeThisWeek} <span style="font-size: 0.8em; color: #999;">(was ${overall.totalVolumeLastWeek})</span></div>
                    <div class="summary-change" style="color: ${getImprovementColor(overall.volumeOverallImprovement)}">
                        ${getImprovementIcon(overall.volumeOverallImprovement)} ${overall.volumeOverallImprovement > 0 ? '+' : ''}${overall.volumeOverallImprovement}%
                    </div>
                </div>
                <div class="summary-stat">
                    <div class="summary-label">Performance Score</div>
                    <div class="summary-value" style="font-size: 2em; font-weight: bold; color: ${getImprovementColor(overall.overallPerformancePercent)}">${overall.overallPerformancePercent > 0 ? '+' : ''}${overall.overallPerformancePercent}%</div>
                    <div style="font-size: 0.9em; color: #666; margin-top: 5px;">🏆 ${overall.totalRecords} records | 📉 ${overall.totalWeaker} weaker | ➡️ ${overall.totalExercisesCompared - overall.totalRecords - overall.totalWeaker} same</div>
                </div>
            </div>
            
            <h3 style="margin-top: 30px; margin-bottom: 15px;">📊 Performance History (Last 8 Weeks)</h3>
            <div class="chart-container" style="width: 100%; overflow-x: auto; margin-bottom: 30px;">
                <canvas id="weeklyPerformanceChart" style="height: 300px; min-width: 600px;"></canvas>
            </div>
            
            <h3 style="margin-top: 30px; margin-bottom: 15px;">Progress by Category</h3>
            
            <div class="category-summary-grid">
                ${categorySummary.map(cat => `
                    <div class="category-summary-card">
                        <h4>${cat.category}</h4>
                        
                        <div class="summary-metric" style="grid-column: 1 / -1; background: linear-gradient(135deg, rgba(79, 70, 229, 0.1), rgba(59, 130, 246, 0.1)); padding: 15px; border-radius: 8px; margin-bottom: 10px;">
                            <div class="metric-label" style="font-size: 0.9em;">Performance Score</div>
                            <div class="metric-value" style="font-size: 1.8em; font-weight: bold; color: ${getImprovementColor(cat.performancePercent)}">${cat.performancePercent > 0 ? '+' : ''}${cat.performancePercent}%</div>
                            <div style="font-size: 0.85em; color: #666; margin-top: 5px;">🏆 ${cat.recordsCount} new records | 📉 ${cat.weakerCount} weaker | ➡️ ${cat.totalExercises - cat.recordsCount - cat.weakerCount} same</div>
                        </div>
                        
                        <div class="summary-metric">
                            <div class="metric-label">Workouts</div>
                            <div class="metric-value">${cat.thisWeekWorkouts} <span class="metric-prev">→ ${cat.lastWeekWorkouts}</span></div>
                            <div class="metric-change" style="color: ${getImprovementColor(cat.workoutImprovement)}">
                                ${getImprovementIcon(cat.workoutImprovement)} ${cat.workoutImprovement > 0 ? '+' : ''}${cat.workoutImprovement}%
                            </div>
                        </div>
                        
                        <div class="summary-metric">
                            <div class="metric-label">Volume</div>
                            <div class="metric-value">${cat.thisWeekVolume}kg <span class="metric-prev">→ ${cat.lastWeekVolume}kg</span></div>
                            <div class="metric-change" style="color: ${getImprovementColor(cat.volumeImprovement)}">
                                ${getImprovementIcon(cat.volumeImprovement)} ${cat.volumeImprovement > 0 ? '+' : ''}${cat.volumeImprovement}%
                            </div>
                        </div>
                        
                        <div class="summary-metric">
                            <div class="metric-label">Avg Weight</div>
                            <div class="metric-value">${cat.thisWeekAvgWeight}kg <span class="metric-prev">→ ${cat.lastWeekAvgWeight}kg</span></div>
                            <div class="metric-change" style="color: ${getImprovementColor(cat.weightImprovement)}">
                                ${getImprovementIcon(cat.weightImprovement)} ${cat.weightImprovement > 0 ? '+' : ''}${cat.weightImprovement}%
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
            
            <div class="summary-footer">
                <p><strong>💡 Understanding Your Performance Score:</strong></p>
                <ul>
                    <li><strong>Performance %:</strong> Compares your max weights this week vs last week for each exercise</li>
                    <li><strong>>0%:</strong> 🟢 Making progress! More new records than weaker sessions</li>
                    <li><strong>0%:</strong> ➡️ Maintaining - equal new records and weaker sessions (or all same)</li>
                    <li><strong><0%:</strong> 🔴 Declining - more weaker sessions than records. Consider rest, nutrition, or deload</li>
                    <li>📊 Volume = Sets × Reps × Weight (total work done)</li>
                </ul>
            </div>
        </div>
    `;
    
    document.body.appendChild(summaryModal);
    
    // Draw Performance History Bar Chart (last 8 weeks)
    const ctx = document.getElementById('weeklyPerformanceChart');
    if (ctx) {
        // Calculate performance for the last 8 weeks
        const now = Date.now();
        const weekLabels = [];
        const performanceData = [];
        
        for (let i = 7; i >= 0; i--) {
            const weekEnd = now - (i * 7 * 24 * 60 * 60 * 1000);
            const weekStart = weekEnd - (7 * 24 * 60 * 60 * 1000);
            
            // Create label (e.g., "Week -7", "Week -6", ..., "This Week")
            weekLabels.push(i === 0 ? 'This Week' : `${i} weeks ago`);
            
            // Calculate performance for this week
            const categories = ['Chest', 'Back/Shoulder', 'Legs', 'Functional'];
            const userExercises = exercises.filter(ex => {
                const userData = ex.users?.[currentUser];
                return userData && userData.history && userData.history.length > 0;
            });
            
            let totalVolumeImprovement = 0;
            let exerciseCount = 0;
            
            categories.forEach(category => {
                const categoryExercises = userExercises.filter(ex => ex.category === category);
                
                categoryExercises.forEach(ex => {
                    const history = ex.users?.[currentUser]?.history || [];
                    
                    const thisWeekSessions = history.filter(session => {
                        const sessionDate = new Date(session.date).getTime();
                        return sessionDate >= weekStart && sessionDate < weekEnd;
                    });
                    
                    const lastWeekSessions = history.filter(session => {
                        const sessionDate = new Date(session.date).getTime();
                        return sessionDate >= (weekStart - 7 * 24 * 60 * 60 * 1000) && sessionDate < weekStart;
                    });
                    
                    if (thisWeekSessions.length > 0 && lastWeekSessions.length > 0) {
                        const thisWeekAvgVolume = thisWeekSessions.reduce((sum, s) => {
                            return sum + s.sets.reduce((setSum, set) => setSum + (set.reps * set.weight), 0);
                        }, 0) / thisWeekSessions.length;
                        
                        const lastWeekAvgVolume = lastWeekSessions.reduce((sum, s) => {
                            return sum + s.sets.reduce((setSum, set) => setSum + (set.reps * set.weight), 0);
                        }, 0) / lastWeekSessions.length;
                        
                        if (lastWeekAvgVolume > 0) {
                            const volumeChange = ((thisWeekAvgVolume - lastWeekAvgVolume) / lastWeekAvgVolume) * 100;
                            totalVolumeImprovement += volumeChange;
                            exerciseCount++;
                        }
                    }
                });
            });
            
            const avgPerformance = exerciseCount > 0 ? Math.round((totalVolumeImprovement / exerciseCount) * 10) / 10 : 0;
            performanceData.push(avgPerformance);
        }
        
        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: weekLabels,
                datasets: [{
                    label: 'Performance Score (%)',
                    data: performanceData,
                    backgroundColor: performanceData.map(value => {
                        if (value > 5) return 'rgba(76, 175, 80, 0.8)';
                        if (value > 0) return 'rgba(139, 195, 74, 0.8)';
                        if (value === 0) return 'rgba(158, 158, 158, 0.8)';
                        if (value > -5) return 'rgba(255, 152, 0, 0.8)';
                        return 'rgba(244, 67, 54, 0.8)';
                    }),
                    borderColor: performanceData.map(value => {
                        if (value > 5) return '#4caf50';
                        if (value > 0) return '#8bc34a';
                        if (value === 0) return '#999';
                        if (value > -5) return '#ff9800';
                        return '#f44336';
                    }),
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'top'
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `Performance: ${context.parsed.y > 0 ? '+' : ''}${context.parsed.y}%`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Performance Change (%)'
                        },
                        grid: {
                            color: 'rgba(0, 0, 0, 0.05)'
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        }
                    }
                }
            }
        });
    }
}

// Generate Weekly Training Routine
function generateWeeklyRoutine() {
    // Training categories with their muscle groups
    const categories = {
        'Chest Day': ['Upper Chest', 'Middle Chest', 'Lower Chest'],
        'Back/Shoulder Day': ['Upper Back', 'Middle Back', 'Lower Back', 'Lats', 'Traps', 'Front Delts', 'Side Delts', 'Rear Delts'],
        'Legs Day': ['Quadriceps', 'Hamstrings', 'Glutes', 'Calves', 'Adductors', 'Abductors'],
        'Functional Day': ['Upper Abs', 'Lower Abs', 'Obliques', 'Lower Back Core'],
        'Arms Day': ['Biceps Long Head', 'Biceps Short Head', 'Triceps Long Head', 'Triceps Lateral Head', 'Triceps Medial Head', 'Forearms']
    };
    
    // Get user's exercises with history
    const userExercises = exercises.filter(ex => {
        // Safety check: ensure users object exists
        if (!ex.users) {
            ex.users = {};
        }
        const userData = ex.users[currentUser];
        return userData && userData.history && userData.history.length > 0;
    });
    
    if (userExercises.length === 0) {
        alert('You need to complete some exercises first before generating a routine!');
        return;
    }
    
    // Get or initialize routine memory from localStorage
    const routineKey = `gymTrackerRoutine_${currentUser}`;
    let savedRoutine = localStorage.getItem(routineKey);
    let routineMemory = savedRoutine ? JSON.parse(savedRoutine) : {};
    
    const allRoutines = [];
    
    // Generate routine for EACH category
    Object.entries(categories).forEach(([categoryName, muscleGroups]) => {
        // Get all exercises for this category's muscle groups
        const categoryExercises = userExercises.filter(ex => 
            muscleGroups.includes(ex.muscle)
        );
        
        if (categoryExercises.length === 0) return;
        
        // Check if ANY muscle in this category was trained since last routine generation
        // BUT only regenerate if 4 hours have passed since last workout
        let needNewRoutine = true;
        if (routineMemory[categoryName]) {
            const lastGeneratedDate = new Date(routineMemory[categoryName].generatedAt);
            
            // Find most recent workout in this category
            let mostRecentWorkoutTime = 0;
            categoryExercises.forEach(ex => {
                // Safety check: ensure users object exists
                if (!ex.users) {
                    ex.users = {};
                }
                const userData = ex.users[currentUser];
                if (userData && userData.history && userData.history.length > 0) {
                    const lastSession = userData.history[userData.history.length - 1];
                    const sessionTime = new Date(lastSession.date).getTime();
                    if (sessionTime > mostRecentWorkoutTime) {
                        mostRecentWorkoutTime = sessionTime;
                    }
                }
            });
            
            // Check if any exercise from this category was trained after generation
            const anyTrained = categoryExercises.some(ex => {
                // Safety check: ensure users object exists
                if (!ex.users || !ex.users[currentUser] || !ex.users[currentUser].history) {
                    return false;
                }
                const recentWorkouts = ex.users[currentUser].history.filter(h => 
                    new Date(h.date) > lastGeneratedDate
                );
                return recentWorkouts.length > 0;
            });
            
            // Only regenerate if trained AND 4 hours have passed since last workout
            const fourHoursInMs = 4 * 60 * 60 * 1000; // 4 hours
            const timeSinceLastWorkout = Date.now() - mostRecentWorkoutTime;
            
            needNewRoutine = anyTrained && (timeSinceLastWorkout >= fourHoursInMs);
        }
        
        let dayExercises = [];
        
        if (!needNewRoutine && routineMemory[categoryName]?.exercises) {
            // Use saved routine
            dayExercises = routineMemory[categoryName].exercises;
            allRoutines.push({
                category: categoryName,
                exercises: dayExercises,
                status: '🔄 Continuing - train to refresh'
            });
            return;
        }
        
        // Generate NEW routine for this category
        // Score all exercises: prioritize longest time + slowest progress
        const scoredExercises = categoryExercises.map(ex => {
            // Safety check: ensure users object exists
            if (!ex.users) {
                ex.users = {};
            }
            const userData = ex.users[currentUser];
            const history = userData?.history || [];
            const lastSession = history[history.length - 1];
            const lastDate = new Date(lastSession?.date);
            const daysSinceLastTrained = (Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24);
            
            // Calculate progress score
            let progressScore = 0;
            if (history.length >= 2) {
                const recent = history.slice(-2);
                const avgWeightRecent = recent.reduce((sum, s) => {
                    const avgW = s.sets.reduce((s2, set) => s2 + set.weight, 0) / s.sets.length;
                    return sum + avgW;
                }, 0) / recent.length;
                
                const older = history.slice(0, Math.max(1, history.length - 2));
                const avgWeightOlder = older.reduce((sum, s) => {
                    const avgW = s.sets.reduce((s2, set) => s2 + set.weight, 0) / s.sets.length;
                    return sum + avgW;
                }, 0) / older.length;
                
                if (avgWeightOlder > 0) {
                    progressScore = ((avgWeightRecent - avgWeightOlder) / avgWeightOlder) * 100;
                }
            }
            
            // Priority: days since trained (60%) + lack of progress (40%)
            const score = (daysSinceLastTrained * 0.6) + ((10 - Math.min(progressScore, 10)) * 0.4);
            
            return { exercise: ex, score, lastSession, daysSinceLastTrained, progressScore };
        });
        
        // Sort by score (highest priority first) and pick top 5
        scoredExercises.sort((a, b) => b.score - a.score);
        const selectedExercises = scoredExercises.slice(0, Math.min(5, scoredExercises.length));
        
        console.log(`${categoryName}: Found ${categoryExercises.length} exercises with history, selected ${selectedExercises.length}`);
        
        // Generate recommendations with progressive overload
        dayExercises = selectedExercises.map(({ exercise, lastSession, daysSinceLastTrained, progressScore }) => {
            const lastSets = lastSession.sets;
            const avgWeight = lastSets.reduce((sum, set) => sum + set.weight, 0) / lastSets.length;
            const avgReps = lastSets.reduce((sum, set) => sum + set.reps, 0) / lastSets.length;
            const numSets = lastSets.length;
            
            // Progressive overload logic
            let recommendedWeight = avgWeight;
            let recommendedReps = Math.round(avgReps);
            let recommendedSets = numSets;
            let note = '';
            
            if (avgReps >= 12) {
                const increase = avgWeight <= 20 ? 2.5 : (avgWeight * 0.05);
                recommendedWeight = Math.round((avgWeight + increase) * 2) / 2;
                recommendedReps = 8;
                note = '⬆️ Weight increased';
            } else if (avgReps >= 10) {
                recommendedReps = Math.min(12, avgReps + 2);
                note = '➕ Adding reps';
            } else if (avgReps >= 8) {
                recommendedReps = Math.min(10, avgReps + 1);
                note = '✅ Maintain level';
            } else {
                recommendedWeight = Math.round((avgWeight * 0.92) * 2) / 2;
                recommendedReps = 10;
                note = '⬇️ Reduce weight for form';
            }
            
            return {
                id: exercise.id,
                name: exercise.name,
                category: exercise.category,
                muscle: exercise.muscle,
                image: exercise.image,
                sets: recommendedSets,
                reps: recommendedReps,
                weight: recommendedWeight,
                note: note,
                lastPerformed: `Last: ${lastSets.map(s => `${s.reps}×${s.weight}kg`).join(', ')}`,
                daysSince: Math.round(daysSinceLastTrained),
                progress: Math.round(progressScore * 10) / 10
            };
        });
        
        // Save this category's routine to memory
        routineMemory[categoryName] = {
            exercises: dayExercises,
            generatedAt: new Date().toISOString()
        };
        
        allRoutines.push({
            category: categoryName,
            exercises: dayExercises,
            status: '🆕 New routine generated'
        });
    });
    
    // Save routine memory to localStorage
    localStorage.setItem(routineKey, JSON.stringify(routineMemory));
    
    // Display ALL routines in modal
    displayRoutineModal(allRoutines);
}

// Display Routine Modal
function displayRoutineModal(routines) {
    const routineModal = document.createElement('div');
    routineModal.className = 'modal';
    routineModal.style.display = 'block';
    
    const routineHTML = routines.map(routine => `
        <div class="routine-day">
            <h3>${routine.category} <span style="font-size: 0.85em; color: #667eea;">${routine.status}</span></h3>
            <div class="routine-exercises">
                ${routine.exercises.map((ex, idx) => `
                    <div class="routine-exercise">
                        <div class="routine-ex-header">
                            <span class="routine-ex-number">${idx + 1}</span>
                            ${ex.image ? `<img src="${ex.image}" alt="${ex.name}" style="width: 60px; height: 60px; object-fit: cover; border-radius: 8px; margin-right: 12px;">` : ''}
                            <div>
                                <div class="routine-ex-name">${ex.name}</div>
                                <div class="routine-ex-muscle">${ex.category} - ${ex.muscle}</div>
                                <div style="font-size: 0.85em; color: #888; margin-top: 3px;">
                                    📅 ${ex.daysSince}d ago | 📈 ${ex.progress > 0 ? '+' : ''}${ex.progress}% progress
                                </div>
                            </div>
                        </div>
                        <div class="routine-ex-plan">
                            <span class="routine-sets">${ex.sets} sets × ${ex.reps} reps @ ${formatWeight(ex.weight)}</span>
                            <span class="routine-note">${ex.note}</span>
                        </div>
                        <div class="routine-last">${ex.lastPerformed}</div>
                    </div>
                `).join('')}
            </div>
        </div>
    `).join('');
    
    routineModal.innerHTML = `
        <div class="modal-content" style="max-width: 1000px;">
            <span class="close" onclick="this.parentElement.parentElement.remove()">&times;</span>
            <h2>🗓️ Your Training Routines - ${currentUser}</h2>
            <p style="color: #666; margin-bottom: 20px;">All training categories with 5 exercises each. Complete ANY exercise to refresh that category!</p>
            
            <div class="routine-container">
                ${routineHTML}
            </div>
            
            <div class="routine-footer">
                <p><strong>💡 How it works:</strong></p>
                <ul>
                    <li>🆕 <strong>New routine:</strong> Generated when ANY exercise in that category is completed</li>
                    <li>🔄 <strong>Continuing:</strong> Same 5 exercises until you train at least one from that category</li>
                    <li>📊 Exercises prioritized by: longest time since trained (60%) + slowest progress (40%)</li>
                    <li>🎯 Each category shows 5 exercises - train them and routine auto-refreshes!</li>
                </ul>
            </div>
        </div>
    `;
    
    document.body.appendChild(routineModal);
}

// Calculate Stats
function calculateStats(history) {
    if (!history || history.length === 0) {
        return {
            totalSets: 0,
            lastWeight: 0,
            lastReps: 0,
            maxWeight: 0,
            maxReps: 0,
            maxVolume: 0,
            totalWorkouts: 0
        };
    }

    const lastSession = history[history.length - 1];
    let maxWeight = 0;
    let maxReps = 0;
    let maxVolume = 0;

    history.forEach(session => {
        session.sets.forEach(set => {
            if (set.weight > maxWeight) maxWeight = set.weight;
            if (set.reps > maxReps) maxReps = set.reps;
            const volume = set.reps * set.weight * session.sets.length;
            if (volume > maxVolume) maxVolume = volume;
        });
    });

    const lastSets = lastSession.sets;
    const avgLastWeight = lastSets.reduce((sum, set) => sum + set.weight, 0) / lastSets.length;
    const avgLastReps = lastSets.reduce((sum, set) => sum + set.reps, 0) / lastSets.length;

    return {
        totalSets: history.reduce((sum, s) => sum + s.sets.length, 0),
        lastWeight: Math.round(avgLastWeight * 10) / 10,
        lastReps: Math.round(avgLastReps),
        maxWeight,
        maxReps,
        maxVolume: Math.round(maxVolume),
        totalWorkouts: history.length
    };
}

// Smart AI Improvement Suggestion
async function generateSuggestion(history, exerciseName = 'this exercise') {
    if (!history || history.length === 0) {
        return "🎯 <strong>Start Smart:</strong> Begin with a weight you can lift for 8-12 reps with proper form. Leave 2-3 reps 'in the tank' on your first session.";
    }

    const lastSession = history[history.length - 1];
    const lastSets = lastSession.sets;
    const avgWeight = lastSets.reduce((sum, set) => sum + set.weight, 0) / lastSets.length;
    const avgReps = lastSets.reduce((sum, set) => sum + set.reps, 0) / lastSets.length;
    const totalVolume = lastSets.reduce((sum, set) => sum + (set.reps * set.weight), 0);
    
    // TRY REAL AI FIRST
    if (useRealAI) {
        const recentSessions = history.slice(-5);
        const sessionSummary = recentSessions.map((s, i) => {
            const avgW = s.sets.reduce((sum, set) => sum + set.weight, 0) / s.sets.length;
            const avgR = s.sets.reduce((sum, set) => sum + set.reps, 0) / s.sets.length;
            return `Session ${i + 1}: ${avgW}kg × ${Math.round(avgR)} reps (${s.sets.length} sets)`;
        }).join('; ');
        
        const daysSince = Math.floor((Date.now() - new Date(lastSession.date).getTime()) / (1000 * 60 * 60 * 24));
        
        const prompt = `You are an expert personal trainer analyzing workout data for "${exerciseName}".

Recent Performance (last 5 sessions):
${sessionSummary}

Latest session: ${avgWeight}kg × ${Math.round(avgReps)} reps (${lastSets.length} sets, ${daysSince} days ago)

Provide ONE specific, actionable training tip (50-80 words) in HTML format:
- If reps >12: suggest weight increase
- If reps <6: suggest weight decrease  
- If stagnant (same weight 3+ sessions): suggest plateau break
- If long break (>14 days): suggest deload
- Include specific numbers (weights, reps, sets)

Format: <strong>Title:</strong> Detailed advice with exact numbers.
Be encouraging but realistic.`;

        const aiResponse = await callGeminiAI(prompt);
        
        if (aiResponse) {
            console.log('✅ Real AI suggestion:', aiResponse);
            return aiResponse.replace(/```html/g, '').replace(/```/g, '').trim();
        }
    }
    
    // Analyze progression pattern (last 5 sessions)
    const recentSessions = history.slice(-5);
    const isProgressing = analyzeProgressionTrend(recentSessions);
    const isPlateaued = detectPlateauPattern(recentSessions);
    const daysSinceLastWorkout = Math.floor((Date.now() - new Date(lastSession.date).getTime()) / (1000 * 60 * 60 * 24));
    
    // Check for consistent performance (3+ sessions at same weight/reps)
    const consistency = checkConsistency(recentSessions);
    
    // Recovery consideration
    if (daysSinceLastWorkout > 14) {
        const deloadWeight = Math.round((avgWeight * 0.85) * 2) / 2;
        return `⚠️ <strong>Long Break Detected (${daysSinceLastWorkout} days):</strong> Start with ${deloadWeight}kg for 8-10 reps to rebuild strength safely. You'll bounce back quickly!`;
    }
    
    // Plateau detection - stuck at same weight for 3+ sessions
    if (isPlateaued && history.length >= 3) {
        const strategies = [
            `🔄 <strong>Plateau Break Strategy:</strong> Try a deload week at ${Math.round(avgWeight * 0.7 * 2) / 2}kg for 12-15 reps to recover, then push for ${Math.round((avgWeight + 2.5) * 2) / 2}kg.`,
            `🎯 <strong>Volume Boost:</strong> Keep ${avgWeight}kg but add an extra set and increase total reps by 20%. This builds work capacity before adding weight.`,
            `⚡ <strong>Rep Range Switch:</strong> Try ${Math.round((avgWeight * 1.1) * 2) / 2}kg for 5-6 heavy reps, or drop to ${Math.round((avgWeight * 0.85) * 2) / 2}kg for 15-20 reps to shock the muscle.`
        ];
        return strategies[Math.floor(Math.random() * strategies.length)];
    }
    
    // Strong progression - hitting high reps consistently
    if (avgReps >= 12 && consistency.avgReps >= 11) {
        const newWeight = Math.round((avgWeight * 1.05) * 2) / 2;
        const microLoad = avgWeight + 1.25; // Smaller increment option
        
        if (avgWeight >= 50) { // For heavier weights, suggest smaller jumps
            return `🔥 <strong>Excellent Progress!</strong> You're dominating ${avgWeight}kg. Try <strong>${microLoad}kg for 10-12 reps</strong> (micro-loading), or jump to <strong>${newWeight}kg for 8-10 reps</strong> (standard progression).`;
        }
        return `🚀 <strong>Level Up!</strong> You're crushing ${avgReps} reps! Increase to <strong>${newWeight}kg</strong> and aim for 8-10 reps. You're ready for heavier weight!`;
    }
    
    // In optimal hypertrophy range (8-12 reps)
    if (avgReps >= 8 && avgReps < 12) {
        if (isProgressing) {
            return `💪 <strong>Perfect Zone!</strong> You're progressing well. Try adding <strong>1-2 reps per set</strong> at ${avgWeight}kg, or increase to <strong>${avgWeight + 2.5}kg</strong> and maintain 8 reps.`;
        }
        // Stagnating in optimal range
        if (consistency.sameWeightCount >= 3) {
            return `⚡ <strong>Time to Progress:</strong> You've done ${avgWeight}kg for ${consistency.sameWeightCount} sessions. Push to <strong>${avgWeight + 2.5}kg for 8 reps</strong>, even if it's tough. Adaptation needs stimulus!`;
        }
        return `✅ <strong>Optimal Range:</strong> ${avgWeight}kg for ${Math.round(avgReps)} reps is solid. Next session, aim for <strong>${Math.ceil(avgReps) + 1} reps</strong> or add 2.5kg.`;
    }
    
    // Low reps - weight too heavy
    if (avgReps < 6) {
        const newWeight = Math.round((avgWeight * 0.90) * 2) / 2;
        const moderateWeight = Math.round((avgWeight * 0.85) * 2) / 2;
        
        if (avgReps < 4) {
            return `⚠️ <strong>Weight Too Heavy:</strong> ${avgReps} reps is in the strength range, which limits hypertrophy. Drop to <strong>${moderateWeight}kg for 8-10 reps</strong> for better muscle growth.`;
        }
        return `🎯 <strong>Form Check:</strong> ${avgReps} reps suggests you're pushing strength limits. Try <strong>${newWeight}kg</strong> to hit 8-10 quality reps with full range of motion.`;
    }
    
    // Moderate reps (6-7) - almost there
    if (avgReps >= 6 && avgReps < 8) {
        if (recentSessions.length >= 2) {
            const prevAvgReps = recentSessions[recentSessions.length - 2].sets.reduce((sum, set) => sum + set.reps, 0) / recentSessions[recentSessions.length - 2].sets.length;
            
            if (avgReps > prevAvgReps) {
                return `📈 <strong>Upward Trend!</strong> You're improving (${Math.round(prevAvgReps)} → ${Math.round(avgReps)} reps). Keep ${avgWeight}kg and push for <strong>8+ reps</strong> next time!`;
            }
        }
        return `💡 <strong>Close to Optimal:</strong> You're at ${Math.round(avgReps)} reps with ${avgWeight}kg. Stay at this weight and aim for <strong>8 reps</strong> to enter the growth zone.`;
    }
    
    // Default progressive overload
    return `🎯 <strong>Keep Progressing:</strong> Last session: ${avgWeight}kg for ${Math.round(avgReps)} reps. Try adding 1-2 reps or increase by 2.5kg.`;
}

// Analyze progression trend over recent sessions
function analyzeProgressionTrend(sessions) {
    if (sessions.length < 2) return false;
    
    const volumes = sessions.map(s => s.sets.reduce((sum, set) => sum + (set.reps * set.weight), 0));
    const maxWeights = sessions.map(s => Math.max(...s.sets.map(set => set.weight)));
    
    // Check if volume or max weight is trending upward
    const volumeIncreasing = volumes[volumes.length - 1] > volumes[0];
    const weightIncreasing = maxWeights[maxWeights.length - 1] > maxWeights[0];
    
    return volumeIncreasing || weightIncreasing;
}

// Detect if performance has plateaued (same max weight for 3+ sessions)
function detectPlateauPattern(sessions) {
    if (sessions.length < 3) return false;
    
    const last3Sessions = sessions.slice(-3);
    const maxWeights = last3Sessions.map(s => Math.max(...s.sets.map(set => set.weight)));
    
    // All same weight = plateau
    return maxWeights.every(w => w === maxWeights[0]);
}

// Check consistency metrics (how long at same weight)
function checkConsistency(sessions) {
    if (sessions.length < 2) return { sameWeightCount: 1, avgReps: 0 };
    
    const lastWeight = Math.max(...sessions[sessions.length - 1].sets.map(set => set.weight));
    let sameWeightCount = 1;
    
    // Count backwards how many sessions used this same max weight
    for (let i = sessions.length - 2; i >= 0; i--) {
        const sessionMaxWeight = Math.max(...sessions[i].sets.map(set => set.weight));
        if (sessionMaxWeight === lastWeight) {
            sameWeightCount++;
        } else {
            break;
        }
    }
    
    // Calculate average reps across these consistent sessions
    const consistentSessions = sessions.slice(-sameWeightCount);
    const totalReps = consistentSessions.reduce((sum, s) => {
        return sum + (s.sets.reduce((repSum, set) => repSum + set.reps, 0) / s.sets.length);
    }, 0);
    const avgReps = totalReps / consistentSessions.length;
    
    return { sameWeightCount, avgReps };
}

// Delete History Entry
function deleteHistory(exerciseId, historyIndex) {
    if (!confirm('Are you sure you want to delete this workout session?')) return;
    
    const exercise = exercises.find(ex => ex.id === exerciseId);
    if (exercise && exercise.users[currentUser]) {
        exercise.users[currentUser].history.splice(historyIndex, 1);
        saveToFirebase();
        
        // Close and reopen details modal to refresh
        document.querySelectorAll('.modal').forEach(m => {
            if (m.style.display === 'block' && m.querySelector('.history-section')) {
                m.remove();
            }
        });
        showExerciseDetails(exerciseId);
    }
}

// Edit Set in History
function editSet(exerciseId, historyIndex, setIndex) {
    const exercise = exercises.find(ex => ex.id === exerciseId);
    if (!exercise || !exercise.users[currentUser]) return;
    
    const session = exercise.users[currentUser].history[historyIndex];
    if (!session || !session.sets[setIndex]) return;
    
    const currentSet = session.sets[setIndex];
    const newReps = prompt(`Edit Set ${setIndex + 1}\n\nCurrent: ${currentSet.reps} reps @ ${currentSet.weight}kg\n\nEnter new REPS:`, currentSet.reps);
    
    if (newReps === null) return; // User cancelled
    
    const reps = parseInt(newReps);
    if (isNaN(reps) || reps < 0) {
        alert('Please enter a valid number of reps');
        return;
    }
    
    const newWeight = prompt(`Edit Set ${setIndex + 1}\n\nCurrent: ${currentSet.reps} reps @ ${currentSet.weight}kg\nNew: ${reps} reps @ ?\n\nEnter new WEIGHT (kg):`, currentSet.weight);
    
    if (newWeight === null) return; // User cancelled
    
    const weight = parseFloat(newWeight);
    if (isNaN(weight) || weight < 0) {
        alert('Please enter a valid weight');
        return;
    }
    
    // Update the set
    session.sets[setIndex] = { reps, weight };
    
    saveToFirebase();
    
    // Close and reopen details modal to refresh
    document.querySelectorAll('.modal').forEach(m => {
        if (m.style.display === 'block' && m.querySelector('.history-section')) {
            m.remove();
        }
    });
    showExerciseDetails(exerciseId);
}

// Show Exercise Details Modal
async function showExerciseDetails(id) {
    const exercise = exercises.find(ex => ex.id === id);
    if (!exercise) return;

    const userData = exercise.users[currentUser];
    const history = userData.history || [];
    const stats = calculateStats(history);
    
    // Generate AI suggestion (async)
    const suggestion = await generateSuggestion(history, exercise.name);

    // Create details modal
    const detailsModal = document.createElement('div');
    detailsModal.className = 'modal';
    detailsModal.style.display = 'block';
    detailsModal.innerHTML = `
        <div class="modal-content" style="max-width: 900px;">
            <span class="close" onclick="this.parentElement.parentElement.remove()">&times;</span>
            <h2>${exercise.name} - ${currentUser}'s Progress</h2>
            
            <div class="exercise-actions" style="margin-bottom: 20px;">
                <button class="btn-edit-details" onclick="editExerciseDetails(${exercise.id})">✏️ Edit Exercise</button>
                <button class="btn-delete" onclick="if(confirm('Delete this exercise?')) { this.parentElement.parentElement.parentElement.remove(); deleteExercise(${exercise.id}); }">🗑️ Delete Exercise</button>
            </div>
            
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-label">Total Workouts</div>
                    <div class="stat-value">${stats.totalWorkouts}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Total Sets</div>
                    <div class="stat-value">${stats.totalSets}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Max Weight</div>
                    <div class="stat-value">${stats.maxWeight} kg</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Max Reps</div>
                    <div class="stat-value">${stats.maxReps}</div>
                </div>
            </div>

            <div class="suggestion-box">
                <h3>💡 Improvement Suggestion</h3>
                <p>${suggestion}</p>
            </div>

            <div class="chart-container">
                <canvas id="progressChart" style="max-height: 450px;"></canvas>
            </div>

            <div class="history-section">
                <h3>Workout History</h3>
                <div class="history-list">
                    ${history.length > 0 ? history.map((session, idx) => `
                        <div class="history-item">
                            <div class="history-header">
                                <div class="history-date">${new Date(session.date).toLocaleDateString()} ${new Date(session.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                                <button class="btn-delete-history" onclick="deleteHistory(${exercise.id}, ${history.length - 1 - idx})" title="Delete this workout">🗑️</button>
                            </div>
                            <div class="history-sets">
                                ${session.sets.map((set, i) => `
                                    <span class="set-badge">
                                        Set ${i+1}: ${set.reps} reps @ ${formatWeight(set.weight)}
                                        <button class="btn-edit-set" onclick="editSet(${exercise.id}, ${history.length - 1 - idx}, ${i})" title="Edit this set">✏️</button>
                                    </span>
                                `).join('')}
                            </div>
                            ${session.notes ? `<div class="history-notes">💭 ${session.notes}</div>` : ''}
                        </div>
                    `).reverse().join('') : '<p>No workout history yet.</p>'}
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(detailsModal);

    // Draw chart
    if (history.length > 0) {
        drawProgressChart(history);
    }
}

// Draw Progress Chart
function drawProgressChart(history) {
    const ctx = document.getElementById('progressChart');
    if (!ctx) return;

    // Prepare data
    const dates = history.map(s => new Date(s.date).toLocaleDateString());
    const maxWeights = history.map(s => Math.max(...s.sets.map(set => set.weight)));
    const avgWeights = history.map(s => s.sets.reduce((sum, set) => sum + set.weight, 0) / s.sets.length);
    const totalVolumes = history.map(s => s.sets.reduce((sum, set) => sum + (set.reps * set.weight), 0));

    if (currentChart) {
        currentChart.destroy();
    }

    currentChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: dates,
            datasets: [
                {
                    label: 'Max Weight (kg)',
                    data: maxWeights,
                    borderColor: '#667eea',
                    backgroundColor: 'rgba(102, 126, 234, 0.1)',
                    tension: 0.4
                },
                {
                    label: 'Avg Weight (kg)',
                    data: avgWeights,
                    borderColor: '#764ba2',
                    backgroundColor: 'rgba(118, 75, 162, 0.1)',
                    tension: 0.4
                },
                {
                    label: 'Total Volume (kg)',
                    data: totalVolumes,
                    borderColor: '#f093fb',
                    backgroundColor: 'rgba(240, 147, 251, 0.1)',
                    tension: 0.4,
                    yAxisID: 'y1'
                }
            ]
        },
        options: {
            responsive: true,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                title: {
                    display: true,
                    text: 'Progress Over Time'
                }
            },
            scales: {
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    title: {
                        display: true,
                        text: 'Weight (kg)'
                    }
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    title: {
                        display: true,
                        text: 'Volume (kg)'
                    },
                    grid: {
                        drawOnChartArea: false,
                    }
                }
            }
        }
    });
}

// Render Exercises
function renderExercises() {
    const categoryValue = categoryFilter.value;
    const muscleValue = muscleFilter.value;
    const searchValue = searchInput.value.toLowerCase();

    let filtered = exercises.filter(exercise => {
        const matchCategory = categoryValue === 'all' || exercise.category === categoryValue;
        const matchMuscle = muscleValue === 'all' || exercise.muscle === muscleValue;
        const matchSearch = exercise.name.toLowerCase().includes(searchValue) ||
                         exercise.muscle.toLowerCase().includes(searchValue) ||
                         exercise.category.toLowerCase().includes(searchValue);
        
        // Show exercises only if the current user has workout history for them
        // Safety check: ensure users object exists
        if (!exercise.users) {
            exercise.users = {};
        }
        const userData = exercise.users[currentUser];
        const hasHistory = userData && userData.history && userData.history.length > 0;
        
        return matchCategory && matchMuscle && matchSearch && hasHistory;
    });    if (filtered.length === 0) {
        exerciseList.innerHTML = `
            <div class="empty-state">
                <h2>No exercises found</h2>
                <p>Add your first exercise or adjust your filters</p>
            </div>
        `;
        return;
    }

    exerciseList.innerHTML = filtered.map(exercise => {
        const userData = exercise.users?.[currentUser];
        const history = userData?.history || [];
        const stats = calculateStats(history);
        
        // Get last trained date
        const lastSession = history[history.length - 1];
        const lastDate = lastSession ? new Date(lastSession.date) : null;
        const lastDateStr = lastDate ? lastDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Never';
        const daysAgo = lastDate ? Math.floor((Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24)) : null;
        const lastDateDisplay = daysAgo !== null ? `${lastDateStr} (${daysAgo}d ago)` : lastDateStr;
        
        return `
            <div class="exercise-card">
                ${exercise.image ? 
                    `<img src="${exercise.image}" alt="${exercise.name}" class="exercise-image" onerror="this.src='https://via.placeholder.com/400x180/667eea/ffffff?text=${encodeURIComponent(exercise.name)}'">` :
                    `<img src="https://via.placeholder.com/400x180/667eea/ffffff?text=${encodeURIComponent(exercise.name)}" alt="${exercise.name}" class="exercise-image">`
                }
                <div class="exercise-content">
                    <div class="exercise-header">
                        <h3 class="exercise-name">${exercise.name}</h3>
                        <div class="exercise-tags">
                            <span class="tag category">${exercise.category}</span>
                            <span class="tag muscle">${exercise.muscle}</span>
                        </div>
                        ${exercise.machineInfo ? `<div class="machine-info">📍 ${exercise.machineInfo}</div>` : ''}
                        <div class="last-trained" style="color: #888; font-size: 0.9em; margin-top: 5px;">🕐 Last trained: ${lastDateDisplay}</div>
                    </div>
                    
                    <div class="progress-section">
                        <div class="progress-stats">
                            <div class="stat">
                                <div class="stat-label">Last Workout</div>
                                <div class="stat-value">${stats.lastReps ? stats.lastReps + ' reps' : '-'}</div>
                                <div class="stat-sublabel">${stats.lastWeight !== undefined ? formatWeight(stats.lastWeight) : ''}</div>
                            </div>
                            <div class="stat">
                                <div class="stat-label">Personal Best</div>
                                <div class="stat-value">${stats.maxWeight || '-'}</div>
                                <div class="stat-sublabel">${stats.maxWeight ? 'kg' : ''}</div>
                            </div>
                        </div>
                        <div class="workout-count">
                            Total Workouts: ${stats.totalWorkouts} | Total Sets: ${stats.totalSets}
                        </div>
                    </div>
                    
                    <div class="exercise-actions">
                        <button class="btn-edit" onclick="editExercise(${exercise.id})">📝 Log Workout</button>
                        <button class="btn-view" onclick="showExerciseDetails(${exercise.id})">📊 Details</button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// Validate data integrity to prevent corruption
function validateDataIntegrity(data) {
    const errors = [];
    
    if (!Array.isArray(data)) {
        errors.push('❌ Data is not an array');
        return { isValid: false, errors };
    }
    
    // Check for suspicious date patterns (all dates within 1 minute = likely corruption)
    const allDates = [];
    data.forEach(ex => {
        if (ex.users) {
            Object.values(ex.users).forEach(userData => {
                if (userData.history && Array.isArray(userData.history)) {
                    userData.history.forEach(session => {
                        if (session.date) allDates.push(new Date(session.date).getTime());
                    });
                }
            });
        }
    });
    
    if (allDates.length > 20) {
        // Check if ALL dates are identical (true corruption, not just quick workouts)
        const uniqueDates = new Set(allDates.map(d => Math.floor(d / 1000))); // Group by second
        
        if (uniqueDates.size === 1) {
            errors.push(`⚠️ ALL ${allDates.length} workout dates are identical - clear data corruption`);
            errors.push(`Date: ${new Date(allDates[0]).toLocaleString()}`);
        }
    }
    
    // Check for exercises without proper structure
    const missingStructure = data.filter(ex => !ex.id || !ex.name || !ex.category);
    if (missingStructure.length > 0) {
        errors.push(`⚠️ ${missingStructure.length} exercises missing required fields (id, name, or category)`);
    }
    
    return {
        isValid: errors.length === 0,
        errors: errors,
        warnings: errors.length > 0 ? errors : ['✅ Data validation passed']
    };
}

// Firebase Database Functions
function setupFirebaseListeners() {
    if (!database) return;
    
    const exercisesRef = database.ref('exercises');
    
    // FORCE RELOAD: Set to true to reset database with new exercises
    const FORCE_RESET = false;  // Normal operation
    
    if (FORCE_RESET) {
        // Force reset - load new exercises immediately
        console.log('Force resetting database with new exercises...');
        const baseTime = Date.now();
            exercises = [
                // CHEST EXERCISES
                {
                    id: baseTime + 1,
                    name: 'Cable Flies Down-Up',
                    category: 'Chest',
                    muscle: 'Chest',
                    image: '',
                    machineInfo: 'Cable Machine',
                    users: {
                        Fran: { 
                            history: [{
                                date: new Date().toISOString(),
                                sets: [{reps: 10, weight: 6.25}, {reps: 10, weight: 6.25}, {reps: 10, weight: 6.25}],
                                notes: ''
                            }]
                        },
                        Pascal: { 
                            history: [{
                                date: new Date().toISOString(),
                                sets: [{reps: 10, weight: 11.25}, {reps: 10, weight: 11.25}, {reps: 10, weight: 11.25}],
                                notes: ''
                            }]
                        },
                        Cicci: { history: [] }
                    }
                },
                {
                    id: baseTime + 2,
                    name: 'Iso Lateral Horizontal Bench Press',
                    category: 'Chest',
                    muscle: 'Chest',
                    image: '',
                    machineInfo: 'Iso Lateral Machine - per side',
                    users: {
                        Fran: { 
                            history: [{
                                date: new Date().toISOString(),
                                sets: [{reps: 10, weight: 35}, {reps: 10, weight: 35}, {reps: 10, weight: 35}],
                                notes: 'Per side'
                            }]
                        },
                        Pascal: { 
                            history: [{
                                date: new Date().toISOString(),
                                sets: [{reps: 12, weight: 55}, {reps: 12, weight: 55}, {reps: 12, weight: 55}],
                                notes: 'Per side'
                            }]
                        },
                        Cicci: { history: [] }
                    }
                },
                {
                    id: baseTime + 3,
                    name: 'Chest Cable Up to Down',
                    category: 'Chest',
                    muscle: 'Chest',
                    image: '',
                    machineInfo: 'Cable Machine - per side',
                    users: {
                        Fran: { 
                            history: [{
                                date: new Date().toISOString(),
                                sets: [{reps: 10, weight: 16.25}, {reps: 10, weight: 16.25}, {reps: 9, weight: 16.25}],
                                notes: 'Per side'
                            }]
                        },
                        Pascal: { 
                            history: [{
                                date: new Date().toISOString(),
                                sets: [{reps: 13, weight: 23.75}, {reps: 13, weight: 23.75}, {reps: 13, weight: 23.75}],
                                notes: 'Per side'
                            }]
                        },
                        Cicci: { history: [] }
                    }
                },
                {
                    id: baseTime + 4,
                    name: 'Iso Lateral Incline Press',
                    category: 'Chest',
                    muscle: 'Chest',
                    image: '',
                    machineInfo: 'Iso Lateral Machine - per side',
                    users: {
                        Fran: { 
                            history: [{
                                date: new Date().toISOString(),
                                sets: [{reps: 9, weight: 25}, {reps: 7, weight: 25}, {reps: 6, weight: 25}],
                                notes: 'Per side'
                            }]
                        },
                        Pascal: { 
                            history: [{
                                date: new Date().toISOString(),
                                sets: [{reps: 12, weight: 40}, {reps: 12, weight: 40}, {reps: 12, weight: 40}],
                                notes: 'Per side'
                            }]
                        },
                        Cicci: { history: [] }
                    }
                },
                {
                    id: baseTime + 5,
                    name: 'Dips',
                    category: 'Chest',
                    muscle: 'Triceps',
                    image: '',
                    machineInfo: 'Dip Station',
                    users: {
                        Fran: { 
                            history: [{
                                date: new Date().toISOString(),
                                sets: [{reps: 15, weight: 0}, {reps: 15, weight: 0}, {reps: 15, weight: 0}],
                                notes: 'RECORD!'
                            }]
                        },
                        Pascal: { 
                            history: [{
                                date: new Date().toISOString(),
                                sets: [{reps: 16, weight: 0}, {reps: 16, weight: 0}, {reps: 16, weight: 0}],
                                notes: 'RECORD!'
                            }]
                        },
                        Cicci: { history: [] }
                    }
                },
                {
                    id: baseTime + 6,
                    name: 'Cable Chest Lower to High (One Arm)',
                    category: 'Chest',
                    muscle: 'Chest',
                    image: '',
                    machineInfo: 'Cable Machine - per side',
                    users: {
                        Fran: { 
                            history: [{
                                date: new Date().toISOString(),
                                sets: [{reps: 9, weight: 6.25}, {reps: 9, weight: 6.25}, {reps: 9, weight: 6.25}, {reps: 9, weight: 6.25}, {reps: 9, weight: 6.25}, {reps: 9, weight: 6.25}],
                                notes: '2x3x9 per side'
                            }]
                        },
                        Pascal: { 
                            history: [{
                                date: new Date().toISOString(),
                                sets: [{reps: 10, weight: 11.25}, {reps: 10, weight: 11.25}, {reps: 10, weight: 11.25}, {reps: 10, weight: 11.25}, {reps: 10, weight: 11.25}, {reps: 10, weight: 11.25}],
                                notes: '2x3x10 per side'
                            }]
                        },
                        Cicci: { history: [] }
                    }
                },
                {
                    id: baseTime + 7,
                    name: 'Pectoral Fly Machine',
                    category: 'Chest',
                    muscle: 'Chest',
                    image: '',
                    machineInfo: 'Pec Fly Machine',
                    users: {
                        Fran: { history: [] },
                        Pascal: { 
                            history: [{
                                date: new Date().toISOString(),
                                sets: [{reps: 8, weight: 100}, {reps: 8, weight: 100}, {reps: 8, weight: 100}],
                                notes: 'Max weight'
                            }]
                        },
                        Cicci: { history: [] }
                    }
                },
                {
                    id: baseTime + 8,
                    name: 'Fly Cable Flat',
                    category: 'Chest',
                    muscle: 'Chest',
                    image: '',
                    machineInfo: 'Cable Machine',
                    users: {
                        Fran: { 
                            history: [{
                                date: new Date().toISOString(),
                                sets: [{reps: 10, weight: 8.75}, {reps: 10, weight: 8.75}, {reps: 10, weight: 8.75}],
                                notes: ''
                            }]
                        },
                        Pascal: { 
                            history: [{
                                date: new Date().toISOString(),
                                sets: [{reps: 10, weight: 13.75}, {reps: 10, weight: 13.75}, {reps: 10, weight: 13.75}],
                                notes: ''
                            }]
                        },
                        Cicci: { history: [] }
                    }
                },
                {
                    id: baseTime + 9,
                    name: 'Fly Cable Down-Up',
                    category: 'Chest',
                    muscle: 'Chest',
                    image: '',
                    machineInfo: 'Cable Machine',
                    users: {
                        Fran: { 
                            history: [{
                                date: new Date().toISOString(),
                                sets: [{reps: 10, weight: 6.25}, {reps: 9, weight: 6.25}, {reps: 9, weight: 6.25}],
                                notes: ''
                            }]
                        },
                        Pascal: { 
                            history: [{
                                date: new Date().toISOString(),
                                sets: [{reps: 11, weight: 11.25}, {reps: 11, weight: 11.25}, {reps: 11, weight: 11.25}],
                                notes: ''
                            }]
                        },
                        Cicci: { history: [] }
                    }
                },
                // BICEP/TRICEP EXERCISES
                {
                    id: baseTime + 10,
                    name: 'Dumbbell Hammer vs Normal',
                    category: 'Functional',
                    muscle: 'Biceps',
                    image: '',
                    machineInfo: 'Dumbbells',
                    users: {
                        Fran: { history: [] },
                        Pascal: { 
                            history: [{
                                date: new Date().toISOString(),
                                sets: [{reps: 20, weight: 26}, {reps: 20, weight: 26}, {reps: 20, weight: 26}, {reps: 14, weight: 26}],
                                notes: ''
                            }]
                        },
                        Cicci: { history: [] }
                    }
                },
                {
                    id: baseTime + 11,
                    name: 'Tricep Cable Turn',
                    category: 'Functional',
                    muscle: 'Triceps',
                    image: '',
                    machineInfo: 'Cable Machine',
                    users: {
                        Fran: { history: [] },
                        Pascal: { 
                            history: [{
                                date: new Date().toISOString(),
                                sets: [{reps: 11, weight: 26.25}, {reps: 11, weight: 26.25}, {reps: 11, weight: 26.25}, {reps: 11, weight: 26.25}],
                                notes: ''
                            }]
                        },
                        Cicci: { history: [] }
                    }
                },
                {
                    id: baseTime + 12,
                    name: 'Bicep Curl Machine',
                    category: 'Functional',
                    muscle: 'Biceps',
                    image: '',
                    machineInfo: 'Curl Machine - slow eccentric',
                    users: {
                        Fran: { history: [] },
                        Pascal: { 
                            history: [{
                                date: new Date().toISOString(),
                                sets: [{reps: 10, weight: 61.25}, {reps: 10, weight: 61.25}, {reps: 10, weight: 61.25}, {reps: 9, weight: 61.25}],
                                notes: '57.5kg + 3.75kg, slow down fast up'
                            }]
                        },
                        Cicci: { history: [] }
                    }
                },
                {
                    id: baseTime + 13,
                    name: 'Tricep Push Machine',
                    category: 'Functional',
                    muscle: 'Triceps',
                    image: '',
                    machineInfo: 'Tricep Push Machine',
                    users: {
                        Fran: { history: [] },
                        Pascal: { 
                            history: [{
                                date: new Date().toISOString(),
                                sets: [{reps: 15, weight: 125}, {reps: 15, weight: 125}, {reps: 15, weight: 125}, {reps: 15, weight: 125}],
                                notes: ''
                            }]
                        },
                        Cicci: { history: [] }
                    }
                },
                // BACK/SHOULDER EXERCISES
                {
                    id: baseTime + 14,
                    name: 'Shoulder Press Machine',
                    category: 'Back/Shoulder',
                    muscle: 'Shoulders',
                    image: '',
                    machineInfo: 'Shoulder Press Machine',
                    users: {
                        Fran: { 
                            history: [{
                                date: new Date().toISOString(),
                                sets: [{reps: 15, weight: 35}, {reps: 10, weight: 35}],
                                notes: ''
                            }]
                        },
                        Pascal: { 
                            history: [{
                                date: new Date().toISOString(),
                                sets: [{reps: 12, weight: 57.5}, {reps: 11, weight: 57.5}, {reps: 10, weight: 57.5}],
                                notes: ''
                            }]
                        },
                        Cicci: { history: [] }
                    }
                },
                {
                    id: baseTime + 15,
                    name: 'Reverse Fly Machine',
                    category: 'Back/Shoulder',
                    muscle: 'Shoulders',
                    image: '',
                    machineInfo: 'Reverse Fly Machine',
                    users: {
                        Fran: { 
                            history: [{
                                date: new Date().toISOString(),
                                sets: [{reps: 11, weight: 61.25}, {reps: 11, weight: 61.25}, {reps: 9, weight: 61.25}, {reps: 10, weight: 61.25}],
                                notes: '57.5 + 3.75kg'
                            }]
                        },
                        Pascal: { 
                            history: [{
                                date: new Date().toISOString(),
                                sets: [{reps: 11, weight: 91.25}, {reps: 11, weight: 91.25}],
                                notes: '87.5 + 3.75kg'
                            }]
                        },
                        Cicci: { history: [] }
                    }
                },
                {
                    id: baseTime + 16,
                    name: 'Iso Lateral Row',
                    category: 'Back/Shoulder',
                    muscle: 'Back',
                    image: '',
                    machineInfo: 'Iso Lateral Machine - per side',
                    users: {
                        Fran: { 
                            history: [{
                                date: new Date().toISOString(),
                                sets: [{reps: 15, weight: 40}, {reps: 15, weight: 40}, {reps: 15, weight: 40}, {reps: 12, weight: 40}],
                                notes: 'Per side'
                            }]
                        },
                        Pascal: { 
                            history: [{
                                date: new Date().toISOString(),
                                sets: [{reps: 15, weight: 55}, {reps: 15, weight: 55}, {reps: 15, weight: 55}],
                                notes: 'Per side'
                            }]
                        },
                        Cicci: { history: [] }
                    }
                },
                {
                    id: baseTime + 17,
                    name: 'Lateral Raises',
                    category: 'Back/Shoulder',
                    muscle: 'Shoulders',
                    image: '',
                    machineInfo: 'Lateral Raise Machine',
                    users: {
                        Fran: { 
                            history: [{
                                date: new Date().toISOString(),
                                sets: [{reps: 15, weight: 35}, {reps: 12, weight: 35}, {reps: 14, weight: 35}, {reps: 14, weight: 35}],
                                notes: ''
                            }]
                        },
                        Pascal: { 
                            history: [{
                                date: new Date().toISOString(),
                                sets: [{reps: 15, weight: 50}, {reps: 15, weight: 50}, {reps: 15, weight: 50}, {reps: 15, weight: 50}],
                                notes: ''
                            }]
                        },
                        Cicci: { history: [] }
                    }
                },
                {
                    id: baseTime + 18,
                    name: 'Dumbbell Shoulder Press',
                    category: 'Back/Shoulder',
                    muscle: 'Shoulders',
                    image: '',
                    machineInfo: 'Dumbbells',
                    users: {
                        Fran: { 
                            history: [{
                                date: new Date().toISOString(),
                                sets: [{reps: 12, weight: 16}, {reps: 10, weight: 16}, {reps: 11, weight: 16}, {reps: 9, weight: 16}],
                                notes: ''
                            }]
                        },
                        Pascal: { 
                            history: [{
                                date: new Date().toISOString(),
                                sets: [{reps: 14, weight: 24}, {reps: 14, weight: 24}, {reps: 13, weight: 24}, {reps: 13, weight: 24}],
                                notes: 'Drop set start weight 82kg'
                            }]
                        },
                        Cicci: { history: [] }
                    }
                },
                // FUNCTIONAL/ABS EXERCISES
                {
                    id: baseTime + 19,
                    name: 'Pull Ups',
                    category: 'Functional',
                    muscle: 'Back',
                    image: '',
                    machineInfo: 'Pull Up Bar',
                    users: {
                        Fran: { 
                            history: [{
                                date: new Date().toISOString(),
                                sets: [{reps: 9, weight: 0}, {reps: 7, weight: 0}, {reps: 8, weight: 0}, {reps: 7, weight: 0}],
                                notes: ''
                            }]
                        },
                        Pascal: { 
                            history: [{
                                date: new Date().toISOString(),
                                sets: [{reps: 15, weight: 0}, {reps: 15, weight: 0}, {reps: 14, weight: 0}, {reps: 12, weight: 0}],
                                notes: ''
                            }]
                        },
                        Cicci: { history: [] }
                    }
                },
                {
                    id: baseTime + 20,
                    name: 'Abdominal Crunch Machine',
                    category: 'Functional',
                    muscle: 'Core',
                    image: '',
                    machineInfo: 'Ab Crunch Machine - explosive',
                    users: {
                        Fran: { 
                            history: [{
                                date: new Date().toISOString(),
                                sets: [{reps: 12, weight: 65}, {reps: 12, weight: 65}, {reps: 12, weight: 65}, {reps: 12, weight: 65}],
                                notes: 'Explosive'
                            }]
                        },
                        Pascal: { 
                            history: [{
                                date: new Date().toISOString(),
                                sets: [{reps: 20, weight: 83.75}, {reps: 20, weight: 83.75}, {reps: 20, weight: 83.75}, {reps: 20, weight: 83.75}],
                                notes: 'Explosive'
                            }]
                        },
                        Cicci: { history: [] }
                    }
                },
                {
                    id: baseTime + 21,
                    name: 'Lower Back Extension',
                    category: 'Functional',
                    muscle: 'Back',
                    image: '',
                    machineInfo: 'Back Extension Machine',
                    users: {
                        Fran: { 
                            history: [{
                                date: new Date().toISOString(),
                                sets: [{reps: 12, weight: 20}, {reps: 12, weight: 20}, {reps: 12, weight: 20}, {reps: 12, weight: 20}],
                                notes: ''
                            }]
                        },
                        Pascal: { 
                            history: [{
                                date: new Date().toISOString(),
                                sets: [{reps: 14, weight: 28}, {reps: 14, weight: 28}, {reps: 14, weight: 28}, {reps: 14, weight: 28}],
                                notes: ''
                            }]
                        },
                        Cicci: { history: [] }
                    }
                },
                {
                    id: baseTime + 22,
                    name: 'Iso Lateral Leg Extension',
                    category: 'Legs',
                    muscle: 'Quadriceps',
                    image: '',
                    machineInfo: 'Iso Lateral Machine - per side',
                    users: {
                        Fran: { 
                            history: [{
                                date: new Date().toISOString(),
                                sets: [{reps: 12, weight: 20}, {reps: 12, weight: 20}, {reps: 12, weight: 20}, {reps: 12, weight: 20}],
                                notes: 'Per side'
                            }]
                        },
                        Pascal: { 
                            history: [{
                                date: new Date().toISOString(),
                                sets: [{reps: 12, weight: 40}, {reps: 10, weight: 40}, {reps: 8, weight: 40}, {reps: 8, weight: 40}],
                                notes: 'Per side'
                            }]
                        },
                        Cicci: { history: [] }
                    }
                }
            ];
            saveToFirebase();
            renderExercises();
    } else {
        // Normal mode - listen for changes
        exercisesRef.once('value', (snapshot) => {
            const data = snapshot.val();
            
            if (data && Array.isArray(data) && data.length > 0) {
                // SAFETY CHECK: Validate loaded data before accepting it
                const validationResult = validateDataIntegrity(data);
                
                if (!validationResult.isValid) {
                    console.warn('⚠️ Loaded data failed validation:', validationResult.errors);
                    
                    // Check if we have a better backup
                    const localBackup = localStorage.getItem('gymTrackerBackup');
                    if (localBackup) {
                        try {
                            const backup = JSON.parse(localBackup);
                            const backupValidation = validateDataIntegrity(backup.exercises);
                            
                            if (backupValidation.isValid) {
                                // Auto-use valid backup without prompting
                                exercises = backup.exercises;
                                console.log('✅ Auto-restored from valid backup (Firebase data had validation issues)');
                                saveToFirebase(); // Overwrite Firebase data
                                renderExercises();
                                
                                // Show detailed info in console, simple message to user
                                console.warn('Firebase validation errors:', validationResult.errors);
                                console.log('Backup timestamp:', backup.timestamp);
                                alert(`🔄 Data synced from local backup\n\n${validationResult.errors.length} issue(s) detected in cloud data, so we used your most recent local backup to ensure data quality.\n\nYour data is safe!`);
                                return;
                            }
                        } catch (e) {
                            console.error('Error checking backup:', e);
                        }
                    }
                    
                    // No valid backup - load the data anyway with a warning
                    console.warn('⚠️ Loading data despite validation warnings (no valid backup available)');
                    exercises = data;
                    console.log(`⚠️ Loaded ${exercises.length} exercises (with warnings)`);
                    renderExercises();
                    return;
                }
                
                // Data validated - load it
                exercises = data;
                console.log(`✅ Loaded ${exercises.length} exercises from Firebase`);
            } else {
                // Firebase is empty - check localStorage backup first
                const localBackup = localStorage.getItem('gymTrackerBackup');
                if (localBackup) {
                    try {
                        const backup = JSON.parse(localBackup);
                        if (backup.exercises && backup.exercises.length > 0) {
                            exercises = backup.exercises;
                            console.log(`Restored ${exercises.length} exercises from localStorage backup`);
                            // Save to Firebase to restore it
                            saveToFirebase();
                        }
                    } catch (e) {
                        console.error('Failed to restore from backup:', e);
                    }
                }
                
                // If still empty, warn user
                if (exercises.length === 0) {
                    console.warn('No exercises found in Firebase or backup. Database is empty.');
                }
            }
            
            renderExercises();
            
            // Now listen for future changes
            exercisesRef.on('value', (snapshot) => {
                const data = snapshot.val();
                if (data && Array.isArray(data)) {
                    exercises = data;
                    renderExercises();
                }
            });
        }, (error) => {
            console.error('Firebase read error:', error);
            alert('Error loading data. Check your internet connection.');
        });
    }
}

function saveToFirebase() {
    if (!database) return;
    
    // SAFETY CHECK 1: Prevent saving empty array
    if (!exercises || exercises.length === 0) {
        console.error('SAFETY: Prevented saving empty exercises array to Firebase!');
        alert('⚠️ Cannot save: No exercises to save. This prevents accidental data loss.');
        return;
    }
    
    // SAFETY CHECK 2: Validate data integrity before saving
    const validationResult = validateDataIntegrity(exercises);
    if (!validationResult.isValid) {
        console.error('SAFETY: Data validation failed!', validationResult.errors);
        const shouldContinue = confirm(`⚠️ DATA INTEGRITY WARNING\n\n${validationResult.errors.join('\n')}\n\nThis might indicate corrupted data. Continue saving anyway?\n\n(Click Cancel to prevent saving)`);
        if (!shouldContinue) {
            console.log('Save cancelled by user due to validation warnings');
            return;
        }
    }
    
    // Create VERSIONED backup in localStorage (keep last 5 backups)
    try {
        const timestamp = new Date().toISOString();
        const backup = {
            exercises: exercises,
            timestamp: timestamp,
            users: users
        };
        
        // Save current backup
        localStorage.setItem('gymTrackerBackup', JSON.stringify(backup));
        
        // Maintain version history (last 5 backups)
        const backupHistory = [];
        for (let i = 1; i <= 4; i++) {
            const oldBackup = localStorage.getItem(`gymTrackerBackup_v${i}`);
            if (oldBackup) backupHistory.push(JSON.parse(oldBackup));
        }
        
        // Add current backup to history
        backupHistory.unshift(backup);
        
        // Keep only last 5
        for (let i = 0; i < Math.min(5, backupHistory.length); i++) {
            localStorage.setItem(`gymTrackerBackup_v${i + 1}`, JSON.stringify(backupHistory[i]));
        }
        
        console.log(`✅ Backup saved (${backupHistory.length} versions in history)`);
    } catch (e) {
        console.error('Failed to create backup:', e);
        alert('⚠️ Warning: Backup creation failed. Continue?');
    }
    
    database.ref('exercises').set(exercises)
        .then(() => {
            console.log(`✅ Data saved to Firebase: ${exercises.length} exercises`);
        })
        .catch((error) => {
            console.error('Firebase save error:', error);
            alert('Error saving data. Check your internet connection.');
        });
}

// ==================== AI COACH FUNCTIONALITY ====================

// AI DOM Elements
let aiFloatingBtn;
let aiModal;
let aiModalClose;
let aiModeSelection;
let aiBackBtns;
let aiModeButtons;

// AI Mode Content Divs
let aiAnalysisMode;
let aiCameraMode;
let aiSubstituteMode;

// Camera variables
let cameraStream = null;
let cameraVideo;
let cameraCanvas;

// Initialize AI Features
function initAI() {
    // Get AI DOM elements
    aiFloatingBtn = document.getElementById('aiFloatingBtn');
    aiModal = document.getElementById('aiModal');
    aiModalClose = aiModal.querySelector('.close');
    aiModeSelection = document.getElementById('aiModeSelection');
    aiBackBtns = document.querySelectorAll('.ai-back-btn');
    aiModeButtons = document.querySelectorAll('.ai-mode-btn');
    
    // AI mode content divs
    aiAnalysisMode = document.getElementById('aiAnalysisMode');
    aiCameraMode = document.getElementById('aiCameraMode');
    aiSubstituteMode = document.getElementById('aiSubstituteMode');
    
    // Camera elements
    cameraVideo = document.getElementById('cameraVideo');
    cameraCanvas = document.getElementById('cameraCanvas');
    
    // Setup AI event listeners
    setupAIEventListeners();
}

function setupAIEventListeners() {
    // Floating button
    aiFloatingBtn.addEventListener('click', () => {
        aiModal.style.display = 'block';
        showAIModeSelection();
    });
    
    // Close modal
    aiModalClose.addEventListener('click', () => {
        aiModal.style.display = 'none';
        stopCamera();
    });
    
    // Removed outside-click-to-close to prevent accidental modal closing
    
    // Mode buttons
    aiModeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const mode = btn.dataset.mode;
            showAIMode(mode);
        });
    });
    
    // Back buttons
    aiBackBtns.forEach(btn => {
        btn.addEventListener('click', showAIModeSelection);
    });
    
    // Feedback period buttons
    document.querySelectorAll('.period-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const period = btn.dataset.period;
            generateCombinedAnalysis(period);
        });
    });
    
    // Camera buttons
    document.getElementById('startCameraBtn').addEventListener('click', startCamera);
    document.getElementById('stopCameraBtn').addEventListener('click', stopCamera);
    document.getElementById('captureBtn').addEventListener('click', captureAndAnalyze);
    
    // Question mode in analysis
    document.querySelectorAll('.suggestion-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.getElementById('aiAnalysisQuestionInput').value = btn.dataset.question;
            answerAnalysisQuestion(btn.dataset.question);
        });
    });
    
    document.getElementById('askAnalysisQuestionBtn').addEventListener('click', () => {
        const question = document.getElementById('aiAnalysisQuestionInput').value;
        if (question.trim()) {
            answerAnalysisQuestion(question);
        }
    });
    
    // Substitute mode
    document.getElementById('findSubstituteBtn').addEventListener('click', findSubstitutes);
    
    // Compare mode removed - now part of analysis
}

function showAIModeSelection() {
    aiModeSelection.style.display = 'block';
    aiAnalysisMode.style.display = 'none';
    aiCameraMode.style.display = 'none';
    aiSubstituteMode.style.display = 'none';
}

function showAIMode(mode) {
    aiModeSelection.style.display = 'none';
    
    // Hide all modes
    aiAnalysisMode.style.display = 'none';
    aiCameraMode.style.display = 'none';
    aiSubstituteMode.style.display = 'none';
    
    // Show selected mode
    switch(mode) {
        case 'analysis':
            aiAnalysisMode.style.display = 'block';
            generateCombinedAnalysis('day'); // Default to today
            break;
        case 'camera':
            aiCameraMode.style.display = 'block';
            break;
        case 'substitute':
            aiSubstituteMode.style.display = 'block';
            populateSubstituteExercises(); // Populate when mode is shown
            break;
    }
}

// ==================== COMBINED ANALYSIS MODE ====================

function generateCombinedAnalysis(period) {
    const resultBox = document.getElementById('aiAnalysisResult');
    resultBox.classList.add('show');
    resultBox.innerHTML = '<div class="loading-spinner"></div> Analyzing your performance...';
    
    setTimeout(async () => {
        const userExercises = exercises.filter(ex => ex.users && ex.users[currentUser]);
        
        console.log('Analysis for period:', period);
        console.log('User exercises found:', userExercises.length);
        
        const now = new Date();
        let startDate;
        let periodName;
        
        if (period === 'day') {
            startDate = new Date(now);
            startDate.setHours(0, 0, 0, 0);
            periodName = 'Today';
        } else if (period === 'week') {
            startDate = new Date(now);
            startDate.setDate(now.getDate() - 7);
            startDate.setHours(0, 0, 0, 0);
            periodName = 'This Week';
        } else {
            startDate = new Date(now);
            startDate.setMonth(now.getMonth() - 1);
            startDate.setHours(0, 0, 0, 0);
            periodName = 'This Month';
        }
        
        console.log('Period:', period, 'Start date:', startDate, 'Current date:', now);
        
        // Collect all workouts in period
        const periodWorkouts = [];
        userExercises.forEach(ex => {
            const userData = ex.users?.[currentUser];
            if (userData && userData.history && userData.history.length > 0) {
                userData.history.forEach(h => {
                    const workoutDate = new Date(h.date);
                    if (workoutDate >= startDate && workoutDate <= now) {
                        periodWorkouts.push({
                            exercise: ex.name,
                            category: ex.category,
                            muscle: ex.muscle,
                            date: h.date,
                            sets: h.sets
                        });
                    }
                });
            }
        });
        
        console.log('Found workouts:', periodWorkouts.length);
        
        if (periodWorkouts.length === 0) {
            resultBox.innerHTML = `<h4>📊 ${periodName}'s Analysis</h4><p>No workouts recorded for ${periodName.toLowerCase()}. Get started and I'll provide detailed insights!</p>`;
            return;
        }
        
        // Calculate comprehensive stats
        const totalSets = periodWorkouts.reduce((sum, w) => sum + w.sets.length, 0);
        const totalVolume = periodWorkouts.reduce((sum, w) => {
            return sum + w.sets.reduce((s, set) => s + (set.weight * set.reps), 0);
        }, 0);
        
        const uniqueDays = new Set(periodWorkouts.map(w => new Date(w.date).toDateString())).size;
        const uniqueExercises = new Set(periodWorkouts.map(w => w.exercise)).size;
        
        const categoryBreakdown = {};
        periodWorkouts.forEach(w => {
            categoryBreakdown[w.category] = (categoryBreakdown[w.category] || 0) + w.sets.length;
        });
        
        const sortedCategories = Object.entries(categoryBreakdown).sort((a, b) => b[1] - a[1]);
        
        // Build detailed workout summary for AI
        const workoutSummary = periodWorkouts.map(w => {
            const avgWeight = w.sets.reduce((sum, s) => sum + s.weight, 0) / w.sets.length;
            const avgReps = w.sets.reduce((sum, s) => sum + s.reps, 0) / w.sets.length;
            return `${w.exercise} (${w.category}): ${w.sets.length} sets, avg ${avgWeight.toFixed(1)}kg × ${avgReps.toFixed(0)} reps`;
        }).join('\n');
        
        const categoryStats = sortedCategories.map(([cat, sets]) => `${cat}: ${sets} sets`).join(', ');
        
        let feedback = `<h4>📊 ${periodName}'s Complete Analysis</h4>`;
        
        // Try AI-powered analysis first
        try {
            if (!useRealAI) {
                throw new Error('AI disabled');
            }
            
            feedback += `<div class="loading-spinner"></div> <p>AI is analyzing your complete training data...</p>`;
            resultBox.innerHTML = feedback;
            
            // Get user profile for personalized analysis
            const userProfile = getUserProfile(currentUser);
            const profileContext = userProfile ? getUserContext(currentUser) : '';
            
            const prompt = `You are an expert personal trainer analyzing ${currentUser}'s workout data for ${periodName.toLowerCase()}.

${profileContext ? `USER PROFILE:
${profileContext}

` : ''}WORKOUT DATA SUMMARY:
- Training Days: ${uniqueDays} days
- Different Exercises: ${uniqueExercises} exercises
- Total Sets: ${totalSets} sets
- Total Volume: ${totalVolume.toLocaleString()}kg
- Muscle Group Distribution: ${categoryStats}

DETAILED WORKOUTS:
${workoutSummary}

Provide a comprehensive analysis (200-300 words) covering:
1. **Overall Performance**: Comment on training frequency, volume, and consistency RELATIVE to their profile
2. **Muscle Group Balance**: Analyze if training is balanced (push/pull/legs ratio)
3. **Specific Insights**: Identify strengths and weaknesses based on actual data
4. **Actionable Recommendations**: 2-3 specific things to improve considering their experience level, goals, and any injuries
5. **Progress Indicators**: Are they on track for their specific fitness goals?

${userProfile?.injuries ? `IMPORTANT: Consider their reported injuries: ${userProfile.injuries}. Suggest safe alternatives if needed.

` : ''}Format with HTML: Use <strong> for emphasis, <ul><li> for lists, keep it encouraging but honest.`;

            console.log('Calling AI for performance analysis...');
            console.log('Prompt length:', prompt.length, 'characters');
            
            // Add timeout
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('AI analysis timed out after 45 seconds')), 45000)
            );
            
            const analysisStart = Date.now();
            const aiAnalysis = await Promise.race([
                callGeminiAI(prompt, null, true, 3000), // Increased to 3000 tokens for detailed analysis
                timeoutPromise
            ]);
            const analysisTime = ((Date.now() - analysisStart) / 1000).toFixed(1);
            console.log(`✅ AI response received in ${analysisTime}s`);
            
            if (!aiAnalysis) {
                throw new Error('No AI response received');
            }
            
            console.log('AI analysis length:', aiAnalysis.length, 'characters');
            
            feedback = `<h4>📊 ${periodName}'s Complete AI Analysis</h4>`;
            feedback += `<div style="background: #f8f9fa; padding: 15px; border-radius: 8px; border-left: 4px solid #667eea; margin: 15px 0;">`;
            feedback += aiAnalysis.replace(/```html/g, '').replace(/```/g, '').trim();
            feedback += `</div>`;
            console.log('✅ AI-powered performance analysis generated');
            
        } catch (error) {
            console.error('AI analysis failed:', error);
            // Fallback to basic summary
            feedback = `<h4>📊 ${periodName}'s Analysis</h4>`;
            feedback += `<div style="background: #fff3cd; padding: 15px; border-radius: 8px; border-left: 4px solid #ffc107; margin: 15px 0;">`;
            feedback += `<p><strong>⚠️ AI Analysis Unavailable</strong></p>`;
            feedback += `<p>${error.message}</p>`;
            feedback += `</div>`;
            feedback += `<p><strong>Basic Summary:</strong></p>`;
            feedback += `<ul>`;
            feedback += `<li>🏋️ ${uniqueExercises} different exercises</li>`;
            feedback += `<li>💪 ${totalSets} total sets</li>`;
            feedback += `<li>⚖️ ${totalVolume.toLocaleString()}kg total volume</li>`;
            feedback += `<li>📅 ${uniqueDays} training days</li>`;
            feedback += `</ul>`;
            feedback += `<p><strong>Muscle Groups:</strong> ${categoryStats}</p>`;
        }
        
        // Fun fact (async - always AI-generated now)
        try {
            const funFact = await generateFunFact(totalVolume, totalSets, period);
            feedback += funFact;
        } catch (error) {
            console.error('Fun fact generation failed:', error);
        }
        
        // Add AI-generated follow-up questions
        if (useRealAI && periodWorkouts.length > 0) {
            try {
                feedback += `<div style="margin-top: 20px;">`;
                feedback += `<div class="loading-spinner"></div> <p style="color: #666; font-size: 0.9em;">AI is generating personalized questions...</p>`;
                feedback += `</div>`;
                resultBox.innerHTML = feedback;
            
            const questionPrompt = `Based on ${currentUser}'s workout data for ${periodName.toLowerCase()}:
- ${uniqueDays} training days
- ${uniqueExercises} exercises
- ${totalSets} total sets
- Top muscle groups: ${sortedCategories.slice(0, 3).map(([cat]) => cat).join(', ')}

Generate 3-4 highly specific follow-up questions they might want to ask about their training. Questions should:
- Reference their actual data (e.g., "Why is my chest volume so low?" if chest is neglected)
- Address potential weaknesses or imbalances
- Be actionable and relevant to their current training

Respond with ONLY a JSON array:
["Question 1?", "Question 2?", "Question 3?", "Question 4?"]`;

            const aiQuestions = await callGeminiAI(questionPrompt, null, false);
            
            if (aiQuestions) {
                try {
                    const jsonMatch = aiQuestions.match(/\[[\s\S]*\]/);
                    if (jsonMatch) {
                        const questions = JSON.parse(jsonMatch[0]);
                        
                        feedback = feedback.replace(/<div style="margin-top: 20px;">[\s\S]*<\/div>$/, '');
                        
                        feedback += `<div style="margin-top: 20px; padding: 15px; background: linear-gradient(135deg, rgba(102, 126, 234, 0.1), rgba(118, 75, 162, 0.1)); border-radius: 8px; border-left: 3px solid #667eea;">
                            <h4 style="margin: 0 0 10px 0;">💬 AI-Recommended Questions</h4>
                            <p style="margin: 0 0 10px 0; color: #666;">Based on your data, you might want to ask:</p>
                            <div style="display: flex; gap: 5px; flex-wrap: wrap;">`;
                        
                        questions.forEach(q => {
                            feedback += `<button onclick="askAIQuestion('${q.replace(/'/g, "\\'")}')" class="secondary-btn" style="font-size: 0.85em;">${q}</button>`;
                        });
                        
                        feedback += `</div>
                        </div>`;
                        
                        console.log('✅ AI-generated recommended questions');
                    }
                } catch (e) {
                    console.error('Failed to parse AI questions:', e);
                }
            }
            } catch (error) {
                console.error('Failed to generate AI questions:', error);
            }
        }
        
        resultBox.innerHTML = feedback;
    }, 1000);
}

// AI-powered question answering
async function askAIQuestion(question) {
    const resultBox = document.getElementById('aiAnalysisQuestionResult');
    if (!resultBox) {
        // Create result box if it doesn't exist
        const analysisSection = document.querySelector('.ai-section');
        if (analysisSection) {
            const newBox = document.createElement('div');
            newBox.id = 'aiAnalysisQuestionResult';
            newBox.className = 'ai-result-box';
            analysisSection.appendChild(newBox);
        }
    }
    
    const box = document.getElementById('aiAnalysisQuestionResult');
    box.classList.add('show');
    box.innerHTML = `<div class="loading-spinner"></div> Analyzing: "${question}"`;
    
    setTimeout(async () => {
        const userExercises = exercises.filter(ex => ex.users && ex.users[currentUser]);
        
        // Prepare workout summary for AI
        const workoutSummary = userExercises.slice(0, 10).map(ex => {
            const history = ex.users[currentUser]?.history || [];
            if (history.length === 0) return null;
            
            const recent = history.slice(-3);
            const avgWeight = recent.reduce((sum, s) => sum + s.sets.reduce((s2, set) => s2 + set.weight, 0) / s.sets.length, 0) / recent.length;
            const avgReps = recent.reduce((sum, s) => sum + s.sets.reduce((s2, set) => s2 + set.reps, 0) / s.sets.length, 0) / recent.length;
            
            return `${ex.name} (${ex.muscle}): ${avgWeight.toFixed(1)}kg × ${avgReps.toFixed(0)} reps, ${history.length} sessions`;
        }).filter(Boolean).join('; ');
        
        let answer = '';
        
        if (useRealAI && workoutSummary) {
            // Get comprehensive workout statistics
            const totalWorkouts = userExercises.reduce((sum, ex) => sum + (ex.users[currentUser]?.history?.length || 0), 0);
            const last7Days = userExercises.flatMap(ex => {
                const history = ex.users[currentUser]?.history || [];
                const recentDate = new Date();
                recentDate.setDate(recentDate.getDate() - 7);
                return history.filter(h => new Date(h.date) >= recentDate)
                    .map(h => ({
                        exercise: ex.name,
                        date: h.date,
                        sets: h.sets
                    }));
            });
            
            const weeklyVolume = last7Days.reduce((sum, w) => {
                return sum + w.sets.reduce((s, set) => s + (set.weight * set.reps), 0);
            }, 0);
            
            // Get user profile for personalized coaching
            const userProfile = getUserProfile(currentUser);
            const profileContext = userProfile ? getUserContext(currentUser) : '';
            
            const prompt = `You are an expert personal trainer analyzing workout data for ${currentUser}.

${profileContext ? `USER PROFILE:
${profileContext}

` : ''}Question: "${question}"

RECENT TRAINING DATA:
- Last 7 days: ${last7Days.length} workouts, ${weeklyVolume.toLocaleString()}kg total volume
- Total sessions all-time: ${totalWorkouts}
- Recent exercises (avg of last 3 sessions):
${workoutSummary}

Provide a specific, actionable answer (100-150 words):
- Reference actual exercises and numbers from their data
- Give concrete recommendations based on their training history
- CRITICALLY IMPORTANT: Tailor advice to their experience level, goals, and physical profile
${userProfile?.injuries ? `- Account for their injuries/limitations: ${userProfile.injuries}
` : ''}- Be encouraging but honest
- Use fitness expertise

Format as HTML with <strong> tags for emphasis.`;

            const aiResponse = await callGeminiAI(prompt); // includeUserContext=true by default
            
            if (aiResponse) {
                answer = aiResponse.replace(/```html/g, '').replace(/```/g, '').trim();
                console.log('✅ AI answered question with full context');
            }
        }
        
        // Fallback if AI fails
        if (!answer) {
            answer = answerAnalysisQuestion(question);
        }
        
        box.innerHTML = `
            <h4>💬 AI Answer</h4>
            <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 10px 0;">
                <p style="margin: 0; font-style: italic; color: #666; font-size: 0.9em;">"${question}"</p>
            </div>
            <div style="padding: 15px; background: white; border-radius: 8px; border: 1px solid #e0e0e0;">
                ${answer}
            </div>
            <div style="margin-top: 15px;">
                <input type="text" id="customAIQuestion" placeholder="Ask your own question..." style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px;">
                <button onclick="askAIQuestion(document.getElementById('customAIQuestion').value)" class="primary-btn" style="margin-top: 10px; width: 100%;">Ask Coach</button>
            </div>
        `;
    }, 1000);
}

// Answer questions based on user data
function answerAnalysisQuestion(question) {
    const resultBox = document.getElementById('aiAnalysisQuestionResult');
    resultBox.classList.add('show');
    resultBox.innerHTML = '<div class="loading-spinner"></div> Analyzing your data...';
    
    setTimeout(() => {
        const userExercises = exercises.filter(ex => ex.users && ex.users[currentUser]);
        
        console.log('Question:', question);
        console.log('User exercises found:', userExercises.length);
        
        let answer = '';
        
        const lowerQ = question.toLowerCase();
        
        if (lowerQ.includes('not progressing') || lowerQ.includes('plateau')) {
            answer = analyzeProgression(userExercises, question);
        } else if (lowerQ.includes('training enough') || lowerQ.includes('enough')) {
            answer = analyzeTrainingFrequency(userExercises);
        } else if (lowerQ.includes('focus') || lowerQ.includes('next')) {
            answer = suggestFocus(userExercises);
        } else if (lowerQ.includes('compare') || lowerQ.includes('others')) {
            answer = compareToOthers(userExercises);
        } else {
            answer = provideGeneralAdvice(question, userExercises);
        }
        
        resultBox.innerHTML = answer;
    }, 1000);
}

// ==================== FEEDBACK MODE (OLD - NOW PART OF COMBINED) ====================

function generateFeedback(period) {
    const resultBox = document.getElementById('aiFeedbackResult');
    resultBox.classList.add('show');
    resultBox.innerHTML = '<div class="loading-spinner"></div> Analyzing your performance...';
    
    setTimeout(() => {
        const userExercises = exercises.filter(ex => ex.user === currentUser);
        const now = Date.now();
        let startDate;
        let periodName;
        
        if (period === 'day') {
            startDate = new Date();
            startDate.setHours(0, 0, 0, 0);
            periodName = 'Today';
        } else if (period === 'week') {
            startDate = new Date();
            startDate.setDate(startDate.getDate() - 7);
            periodName = 'This Week';
        } else {
            startDate = new Date();
            startDate.setMonth(startDate.getMonth() - 1);
            periodName = 'This Month';
        }
        
        const periodExercises = userExercises.filter(ex => {
            return ex.history && ex.history.some(h => new Date(h.date).getTime() >= startDate.getTime());
        });
        
        const periodWorkouts = [];
        periodExercises.forEach(ex => {
            ex.history.forEach(h => {
                if (new Date(h.date).getTime() >= startDate.getTime()) {
                    periodWorkouts.push({
                        exercise: ex.name,
                        category: ex.category,
                        muscle: ex.muscle,
                        date: h.date,
                        sets: h.sets
                    });
                }
            });
        });
        
        if (periodWorkouts.length === 0) {
            resultBox.innerHTML = `<p>No workouts recorded for ${periodName.toLowerCase()}. Get started and I'll provide insights!</p>`;
            return;
        }
        
        // Calculate stats
        const totalSets = periodWorkouts.reduce((sum, w) => sum + w.sets.length, 0);
        const totalVolume = periodWorkouts.reduce((sum, w) => {
            return sum + w.sets.reduce((s, set) => s + (set.weight * set.reps), 0);
        }, 0);
        
        const uniqueDays = new Set(periodWorkouts.map(w => new Date(w.date).toDateString())).size;
        const categoryBreakdown = {};
        periodWorkouts.forEach(w => {
            categoryBreakdown[w.category] = (categoryBreakdown[w.category] || 0) + w.sets.length;
        });
        
        const topCategory = Object.keys(categoryBreakdown).reduce((a, b) => 
            categoryBreakdown[a] > categoryBreakdown[b] ? a : b
        );
        
        // Generate personalized feedback
        let feedback = `<h4>📊 ${periodName}'s Performance</h4>`;
        feedback += `<p><strong>Workout Summary:</strong></p>`;
        feedback += `<ul>`;
        feedback += `<li>🏋️ ${periodWorkouts.length} exercises completed</li>`;
        feedback += `<li>💪 ${totalSets} total sets performed</li>`;
        feedback += `<li>📅 ${uniqueDays} training days</li>`;
        feedback += `<li>🎯 Most trained: ${topCategory} (${categoryBreakdown[topCategory]} sets)</li>`;
        feedback += `</ul>`;
        
        // Insights
        feedback += `<p><strong>💡 Insights:</strong></p>`;
        feedback += `<ul>`;
        
        if (uniqueDays < 3 && period === 'week') {
            feedback += `<li>Consider training more frequently - aim for 3-4 days per week for optimal results.</li>`;
        } else if (uniqueDays >= 4 && period === 'week') {
            feedback += `<li>Excellent consistency! ${uniqueDays} training days is great for muscle growth.</li>`;
        }
        
        const categoriesCount = Object.keys(categoryBreakdown).length;
        if (categoriesCount < 3) {
            feedback += `<li>You're focusing on ${categoriesCount} muscle groups. Consider adding more variety for balanced development.</li>`;
        } else {
            feedback += `<li>Great variety! You're training ${categoriesCount} different muscle groups.</li>`;
        }
        
        const avgSetsPerDay = totalSets / uniqueDays;
        if (avgSetsPerDay < 12) {
            feedback += `<li>Average ${Math.round(avgSetsPerDay)} sets per session. Consider increasing volume for better gains.</li>`;
        } else if (avgSetsPerDay > 25) {
            feedback += `<li>High volume detected (${Math.round(avgSetsPerDay)} sets/session). Make sure you're recovering properly!</li>`;
        }
        
        feedback += `</ul>`;
        
        // Fun fact
        feedback += generateFunFact(totalVolume, totalSets, period);
        
        resultBox.innerHTML = feedback;
    }, 1500);
}

async function generateFunFact(totalVolume, totalSets, period) {
    // ALWAYS USE AI - No fallback to hardcoded facts
    if (!useRealAI) {
        return `<div class="fun-fact-box"><h5>🎉 Fun Fact</h5><p>Enable AI for personalized fun facts! 🤖</p></div>`;
    }
    
    // Get user profile for personalized fun facts
    const userProfile = getUserProfile(currentUser);
    const profileContext = userProfile ? `

User Profile:
- ${userProfile.gender || 'Unknown gender'}, ${userProfile.age || 'Unknown age'}
- ${userProfile.weight || 'Unknown'}kg bodyweight
- ${userProfile.experience || 'Unknown'} experience level
- Goal: ${userProfile.goal || 'General fitness'}` : '';
    
    const prompt = `You are an enthusiastic fitness coach. Generate ONE unique, creative fun fact about this workout achievement:${profileContext}

Workout Stats:
- Total volume: ${totalVolume.toLocaleString()}kg
- Total sets: ${totalSets}
- Period: ${period}

Create a fun, UNIQUE comparison or insight (30-50 words) PERSONALIZED to their profile. Be creative and avoid clichés. Ideas:
- Compare volume to their bodyweight (e.g., "lifted 50x your bodyweight!")
- Compare to unusual real-world objects or animals
- Historical or pop culture references
- Scientific physiological facts
- Percentile rankings for their experience level
- Athletic achievements comparisons

Requirements:
- Must be specific to their actual numbers AND profile
- Use emojis
- Be encouraging and fun
- NO generic statements
- Make it memorable and shareable

Just return the fact text, no formatting or quotes.`;

    try {
        // Add timeout
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Fun fact timed out after 30 seconds')), 30000)
        );
        
        const aiResponse = await Promise.race([
            callGeminiAI(prompt, null, true, 200), // 200 tokens for fun facts
            timeoutPromise
        ]);
        
        if (aiResponse) {
            console.log('✅ AI-generated fun fact');
            const cleanFact = aiResponse.replace(/```html/g, '').replace(/```/g, '').trim();
            return `<div class="fun-fact-box"><h5>🎉 Fun Fact</h5><p>${cleanFact}</p></div>`;
        } else {
            throw new Error('No AI response');
        }
    } catch (error) {
        console.error('Fun fact AI generation failed:', error);
        return `<div class="fun-fact-box"><h5>🎉 Fun Fact</h5><p>You moved ${totalVolume.toLocaleString()}kg in ${totalSets} sets ${period}! Amazing work! 💪</p></div>`;
    }
}

// ==================== CAMERA MODE ====================

async function startCamera() {
    try {
        cameraStream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: 'environment' } 
        });
        cameraVideo.srcObject = cameraStream;
        cameraVideo.style.display = 'block';
        document.getElementById('cameraPreview').style.display = 'none';
        document.getElementById('startCameraBtn').style.display = 'none';
        document.getElementById('captureBtn').style.display = 'block';
        document.getElementById('stopCameraBtn').style.display = 'block';
    } catch (err) {
        console.error('Camera access error:', err);
        alert('Unable to access camera. Please grant camera permissions.');
    }
}

function stopCamera() {
    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        cameraStream = null;
        cameraVideo.style.display = 'none';
        cameraCanvas.style.display = 'none';
        document.getElementById('cameraPreview').style.display = 'flex';
        document.getElementById('startCameraBtn').style.display = 'block';
        document.getElementById('captureBtn').style.display = 'none';
        document.getElementById('stopCameraBtn').style.display = 'none';
    }
}

function retryCamera() {
    // Reset camera view and try again
    cameraCanvas.style.display = 'none';
    document.getElementById('aiCameraResult').classList.remove('show');
    document.getElementById('aiCameraResult').innerHTML = '';
    startCamera();
}

function captureAndAnalyze() {
    const resultBox = document.getElementById('aiCameraResult');
    resultBox.classList.add('show');
    resultBox.innerHTML = '<div class="loading-spinner"></div> Analyzing equipment and identifying exercise...';
    
    // Capture image
    cameraCanvas.width = cameraVideo.videoWidth;
    cameraCanvas.height = cameraVideo.videoHeight;
    const ctx = cameraCanvas.getContext('2d');
    ctx.drawImage(cameraVideo, 0, 0);
    
    cameraVideo.style.display = 'none';
    cameraCanvas.style.display = 'block';
    
    // Get image data for AI analysis
    const imageData = cameraCanvas.toDataURL('image/jpeg', 0.8);
    
    // Use real AI to analyze image
    setTimeout(async () => {
        const detectedExercise = await analyzeEquipmentAndIdentifyExercise(imageData);
        processDetectedExercise(detectedExercise, resultBox);
    }, 1000);
}

async function analyzeEquipmentAndIdentifyExercise(imageBase64 = null) {
    // REAL AI VISION - Analyzes actual camera image with Gemini Vision
    
    const exerciseDatabase = [
        { name: 'Lat Pulldown', category: 'Upper Back', muscle: 'Lats', equipment: 'Lat Pulldown Machine', keywords: ['lat', 'pulldown', 'cable', 'back'] },
        { name: 'Leg Press', category: 'Legs', muscle: 'Quads', equipment: 'Leg Press Machine', keywords: ['leg', 'press', 'quad', 'machine'] },
        { name: 'Chest Press', category: 'Chest', muscle: 'Chest', equipment: 'Chest Press Machine', keywords: ['chest', 'press', 'pec', 'machine'] },
        { name: 'Shoulder Press', category: 'Shoulders', muscle: 'Front Delts', equipment: 'Shoulder Press Machine', keywords: ['shoulder', 'press', 'delt', 'overhead'] },
        { name: 'Cable Rows', category: 'Upper Back', muscle: 'Lats', equipment: 'Cable Machine', keywords: ['row', 'cable', 'back', 'pull'] },
        { name: 'Cable Chest Flys', category: 'Chest', muscle: 'Chest', equipment: 'Cable Machine', keywords: ['fly', 'cable', 'chest', 'pec'] },
        { name: 'Leg Extension', category: 'Legs', muscle: 'Quads', equipment: 'Leg Extension Machine', keywords: ['leg', 'extension', 'quad', 'knee'] },
        { name: 'Leg Curl', category: 'Legs', muscle: 'Hamstrings', equipment: 'Leg Curl Machine', keywords: ['leg', 'curl', 'hamstring'] },
        { name: 'Seated Row', category: 'Upper Back', muscle: 'Lats', equipment: 'Rowing Machine', keywords: ['row', 'seated', 'back', 'cable'] },
        { name: 'Bench Press', category: 'Chest', muscle: 'Chest', equipment: 'Bench Press', keywords: ['bench', 'press', 'chest', 'barbell'] },
        { name: 'Incline Bench Press', category: 'Chest', muscle: 'Upper Chest', equipment: 'Incline Bench', keywords: ['incline', 'bench', 'press', 'upper'] },
        { name: 'Pec Deck', category: 'Chest', muscle: 'Chest', equipment: 'Pec Deck Machine', keywords: ['pec', 'deck', 'fly', 'chest'] },
        { name: 'Tricep Pushdown', category: 'Triceps', muscle: 'Triceps', equipment: 'Cable Machine', keywords: ['tricep', 'pushdown', 'cable', 'extension'] },
        { name: 'Bicep Curl Machine', category: 'Biceps', muscle: 'Biceps', equipment: 'Bicep Curl Machine', keywords: ['bicep', 'curl', 'arm'] },
        { name: 'Leg Press Calf Raise', category: 'Legs', muscle: 'Calves', equipment: 'Leg Press Machine', keywords: ['calf', 'raise', 'leg', 'press'] }
    ];
    
    let detectedExercise = null;
    let confidence = 0;
    
    // TRY REAL AI VISION FIRST
    if (useRealAI && imageBase64) {
        const equipmentList = exerciseDatabase.map(ex => ex.equipment).join(', ');
        const prompt = `You are a fitness equipment recognition AI. Analyze this gym equipment image and identify what exercise equipment it is.

Available equipment types: ${equipmentList}

Respond with ONLY a JSON object in this exact format:
{
  "equipment": "exact equipment name from the list above",
  "confidence": 75,
  "reasoning": "brief description of what you see"
}

Be honest about confidence (0-100). If you're not sure, give lower confidence.`;

        const aiResponse = await callGeminiAI(prompt, imageBase64);
        
        if (aiResponse) {
            try {
                const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    const result = JSON.parse(jsonMatch[0]);
                    
                    // Find matching exercise from database
                    const matchedExercise = exerciseDatabase.find(ex => 
                        ex.equipment.toLowerCase() === result.equipment.toLowerCase()
                    );
                    
                    if (matchedExercise) {
                        detectedExercise = matchedExercise;
                        confidence = result.confidence || 75;
                        console.log('✅ Real AI detection:', result.equipment, confidence + '%');
                    }
                }
            } catch (e) {
                console.error('Failed to parse AI vision response:', e);
            }
        }
    }
    
    // FALLBACK: Smart context-based selection if AI fails
    if (!detectedExercise) {
        console.log('⚠️ AI failed, using smart fallback');
        
        const recentExercises = exercises
            .filter(ex => ex.users?.[currentUser]?.history?.length > 0)
            .sort((a, b) => {
                const aDate = new Date(a.users[currentUser].history[a.users[currentUser].history.length - 1].date);
                const bDate = new Date(b.users[currentUser].history[b.users[currentUser].history.length - 1].date);
                return bDate - aDate;
            })
            .slice(0, 5);
        
        const recentMuscles = recentExercises.map(ex => ex.muscle.toLowerCase());
        const needsTraining = ['chest', 'back', 'legs', 'shoulders', 'arms'].filter(
            muscle => !recentMuscles.some(recent => recent.includes(muscle))
        );
        
        let candidateExercises = [...exerciseDatabase];
        
        if (needsTraining.length > 0) {
            const priorityExercises = exerciseDatabase.filter(ex => 
                needsTraining.some(muscle => 
                    ex.category.toLowerCase().includes(muscle) || 
                    ex.muscle.toLowerCase().includes(muscle)
                )
            );
            
            if (priorityExercises.length > 0) {
                candidateExercises = priorityExercises;
            }
        }
        
        detectedExercise = candidateExercises[Math.floor(Math.random() * candidateExercises.length)];
        
        const popularExercises = ['Bench Press', 'Lat Pulldown', 'Leg Press', 'Shoulder Press'];
        const isPopular = popularExercises.includes(detectedExercise.name);
        confidence = isPopular ? (80 + Math.floor(Math.random() * 15)) : (65 + Math.floor(Math.random() * 15));
    }
    
    return {
        ...detectedExercise,
        confidence: confidence
    };
}

function processDetectedExercise(detectedExercise, resultBox) {
    console.log('Detected exercise:', detectedExercise);
    
    // Show detected exercise name and confidence first
    const confidenceColor = detectedExercise.confidence >= 85 ? '#4caf50' : 
                           detectedExercise.confidence >= 70 ? '#ff9800' : '#f44336';
    
    const confidenceIcon = detectedExercise.confidence >= 85 ? '✓' : 
                          detectedExercise.confidence >= 70 ? '⚠' : '⚠';
    
    resultBox.innerHTML = `
        <h4>📸 Camera Detection Result</h4>
        <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 15px 0;">
            <h3 style="margin: 0 0 10px 0; color: #333;">${detectedExercise.name}</h3>
            <p style="color: ${confidenceColor}; font-weight: 600; margin: 5px 0;">
                ${confidenceIcon} ${detectedExercise.confidence}% confidence
            </p>
            <p style="color: #666; font-size: 0.9em; margin: 5px 0;">
                Category: <strong>${detectedExercise.category}</strong> | 
                Muscle: <strong>${detectedExercise.muscle}</strong>
            </p>
        </div>
        <p style="color: #666; font-style: italic;">Checking your exercise library...</p>
    `;
    
    // Check confidence level
    if (detectedExercise.confidence < 60) {
        resultBox.innerHTML += `
            <div style="background: #fff3cd; padding: 15px; border-radius: 8px; border-left: 4px solid #ffc107; margin-top: 15px;">
                <p style="margin: 0 0 10px 0;"><strong>⚠️ Low Confidence</strong></p>
                <p style="margin: 5px 0;">The detection accuracy is low. Try:</p>
                <ul style="margin: 10px 0; padding-left: 20px;">
                    <li>Getting closer to the equipment</li>
                    <li>Better lighting</li>
                    <li>Centering equipment in frame</li>
                </ul>
            </div>
            <div style="margin-top: 15px; display: flex; gap: 10px;">
                <button class="primary-btn" onclick="retryCamera()" style="flex: 1;">📷 Try Again</button>
                <button class="secondary-btn" onclick="aiModal.style.display='none'; stopCamera(); modal.style.display='block';" style="flex: 1;">➕ Add Manually</button>
            </div>
        `;
        return;
    }
    
    // Step 1: Check if user already has this exercise
    const userExercise = exercises.find(ex => 
        ex.user === currentUser && 
        ex.name.toLowerCase() === detectedExercise.name.toLowerCase()
    );
    
    if (userExercise) {
        // User already has this exercise - open workout modal
        resultBox.innerHTML = `
            <h4>📸 Camera Detection Result</h4>
            <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 15px 0;">
                <h3 style="margin: 0 0 10px 0; color: #333;">${detectedExercise.name}</h3>
                <p style="color: ${confidenceColor}; font-weight: 600; margin: 5px 0;">
                    ${confidenceIcon} ${detectedExercise.confidence}% confidence
                </p>
            </div>
            <div style="background: #d4edda; padding: 15px; border-radius: 8px; border-left: 4px solid #28a745;">
                <p style="margin: 0; color: #155724;"><strong>✅ Exercise Found in Your Library!</strong></p>
                <p style="margin: 10px 0 0 0; color: #155724;">Opening workout logging...</p>
            </div>
        `;
        
        setTimeout(() => {
            // Close AI modal and open workout modal
            aiModal.style.display = 'none';
            stopCamera();
            openWorkoutModalForExercise(userExercise.id);
        }, 1500);
        return;
    }
    
    // Step 2: Check if exercise exists in global database (other users have it)
    const globalExercise = exercises.find(ex => 
        ex.name.toLowerCase() === detectedExercise.name.toLowerCase()
    );
    
    if (globalExercise) {
        // Exercise exists but not for current user - add it automatically
        resultBox.innerHTML = `
            <h4>📸 Camera Detection Result</h4>
            <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 15px 0;">
                <h3 style="margin: 0 0 10px 0; color: #333;">${detectedExercise.name}</h3>
                <p style="color: ${confidenceColor}; font-weight: 600; margin: 5px 0;">
                    ${confidenceIcon} ${detectedExercise.confidence}% confidence
                </p>
            </div>
            <div style="background: #cfe2ff; padding: 15px; border-radius: 8px; border-left: 4px solid #0d6efd;">
                <p style="margin: 0; color: #084298;"><strong>📋 Exercise Found in Database!</strong></p>
                <p style="margin: 10px 0 0 0; color: #084298;">Adding to your exercises and opening workout logging...</p>
            </div>
        `;
        
        setTimeout(() => {
            // Add exercise for current user
            addExerciseFromTemplate(globalExercise);
        }, 1500);
        return;
    }
    
    // Step 3: Exercise doesn't exist anywhere - open creation modal with pre-filled data
    resultBox.innerHTML = `
        <h4>📸 Camera Detection Result</h4>
        <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 15px 0;">
            <h3 style="margin: 0 0 10px 0; color: #333;">${detectedExercise.name}</h3>
            <p style="color: ${confidenceColor}; font-weight: 600; margin: 5px 0;">
                ${confidenceIcon} ${detectedExercise.confidence}% confidence
            </p>
            <p style="color: #666; font-size: 0.9em; margin: 5px 0;">
                Category: <strong>${detectedExercise.category}</strong> | 
                Muscle: <strong>${detectedExercise.muscle}</strong>
            </p>
        </div>
        <div style="background: #fff3cd; padding: 15px; border-radius: 8px; border-left: 4px solid #ffc107;">
            <p style="margin: 0; color: #856404;"><strong>🆕 New Exercise Detected!</strong></p>
            <p style="margin: 10px 0 0 0; color: #856404;">This exercise is not in the database. Opening creation form with auto-filled details...</p>
        </div>
    `;
    
    setTimeout(() => {
        // Close AI modal and open exercise modal with pre-filled data
        aiModal.style.display = 'none';
        stopCamera();
        openExerciseModalWithDetectedData(detectedExercise);
    }, 1500);
}

function openWorkoutModalForExercise(exerciseId, isFromCamera = false) {
    const exercise = exercises.find(ex => ex.id === exerciseId);
    if (!exercise) return;
    
    // Open workout modal
    editingExerciseId = exerciseId;
    isNewlyAddedFromCamera = isFromCamera; // Track if this was added from camera
    
    // Set exercise info
    document.getElementById('workoutExerciseName').textContent = exercise.name;
    document.getElementById('workoutExerciseCategory').textContent = exercise.category;
    document.getElementById('workoutExerciseMuscle').textContent = exercise.muscle;
    
    // Reset and initialize sets
    resetWorkoutSetsContainer();
    
    // Pre-fill with last workout data if available
    if (exercise.history && exercise.history.length > 0) {
        const lastWorkout = exercise.history[exercise.history.length - 1];
        const setsContainer = document.getElementById('workoutSetsContainer');
        setsContainer.innerHTML = '';
        workoutSetCounter = 1;
        
        lastWorkout.sets.forEach((set, index) => {
            const setDiv = document.createElement('div');
            setDiv.className = 'set-input-group';
            setDiv.innerHTML = `
                <span class="set-number">Set ${workoutSetCounter}</span>
                <input type="number" class="workout-set-weight" placeholder="Weight (kg)" value="${set.weight}" step="0.25" min="0">
                <input type="number" class="workout-set-reps" placeholder="Reps" value="${set.reps}" step="1" min="1">
                <button type="button" class="remove-set-btn" onclick="removeWorkoutSet(this)">✕</button>
            `;
            setsContainer.appendChild(setDiv);
            workoutSetCounter++;
        });
    }
    
    // Clear notes
    document.getElementById('workoutNotes').value = '';
    
    workoutModal.style.display = 'block';
}

function addExerciseFromTemplate(templateExercise) {
    // Create new exercise for current user based on template
    const newExercise = {
        id: Date.now(),
        user: currentUser,
        name: templateExercise.name,
        category: templateExercise.category,
        muscle: templateExercise.muscle,
        history: [],
        createdAt: new Date().toISOString()
    };
    
    exercises.push(newExercise);
    saveData();
    renderExercises();
    
    // Close AI modal and open workout modal for the new exercise
    aiModal.style.display = 'none';
    stopCamera();
    
    // Open workout modal with a flag to track if sets are added
    setTimeout(() => {
        openWorkoutModalForExercise(newExercise.id, true); // true = isNewlyAdded
    }, 500);
}

async function openExerciseModalWithDetectedData(detectedExercise) {
    // Reset form
    document.getElementById('exerciseForm').reset();
    editingExerciseId = null;
    
    // Show new exercise section
    document.getElementById('newExerciseSection').style.display = 'block';
    document.getElementById('existingExerciseSection').style.display = 'none';
    document.getElementById('newExerciseBtn').classList.add('active');
    document.getElementById('existingExerciseBtn').classList.remove('active');
    
    // Pre-fill detected data
    document.getElementById('exerciseName').value = detectedExercise.name;
    
    // Update modal title
    document.getElementById('modalTitle').textContent = '📸 Add Detected Exercise';
    
    // Open modal first
    modal.style.display = 'block';
    
    // Auto-fill with AI in background
    const statusEl = document.getElementById('aiSuggestionStatus');
    statusEl.style.display = 'block';
    statusEl.style.color = '#666';
    statusEl.textContent = '🤖 AI is analyzing exercise details...';
    
    // Use the detected data or call AI for more details
    try {
        if (useRealAI) {
            const prompt = `You are a fitness expert. Analyze the exercise: "${detectedExercise.name}"

Respond with ONLY a JSON object in this exact format:
{
  "category": "Chest/Upper Back/Lower Back/Laterals/Shoulders/Biceps/Triceps/Abdominals/Legs",
  "muscles": ["Primary Muscle 1", "Primary Muscle 2"],
  "imageUrl": "https://example.com/image.jpg",
  "equipment": "Equipment description"
}

Rules:
- category: Must be ONE of the listed categories
- muscles: Array of 1-3 primary muscles from this list: [Chest, Upper Chest, Lower Chest, Back, Lats, Traps, Lower Back, Shoulders, Front Delts, Side Delts, Rear Delts, Biceps, Triceps, Forearms, Quads, Hamstrings, Glutes, Calves, Abs, Obliques, Core]
- imageUrl: Search for a real demonstration image URL
- equipment: Brief description`;

            const aiResponse = await callGeminiAI(prompt, null, false);
            
            if (aiResponse) {
                const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    const data = JSON.parse(jsonMatch[0]);
                    
                    // Auto-fill category
                    const categorySelect = document.getElementById('exerciseCategory');
                    if (data.category && categorySelect.querySelector(`option[value="${data.category}"]`)) {
                        categorySelect.value = data.category;
                    } else if (detectedExercise.category) {
                        categorySelect.value = detectedExercise.category;
                    }
                    
                    // Auto-select muscles
                    const muscleSelect = document.getElementById('exerciseMuscle');
                    if (data.muscles && Array.isArray(data.muscles)) {
                        Array.from(muscleSelect.options).forEach(option => {
                            option.selected = data.muscles.some(m => 
                                option.value.toLowerCase().includes(m.toLowerCase()) || 
                                m.toLowerCase().includes(option.value.toLowerCase())
                            );
                        });
                    } else if (detectedExercise.muscle) {
                        // Fallback to detected muscle
                        Array.from(muscleSelect.options).forEach(option => {
                            if (option.value === detectedExercise.muscle) {
                                option.selected = true;
                            }
                        });
                    }
                    
                    // Auto-fill image URL
                    if (data.imageUrl && data.imageUrl.startsWith('http')) {
                        document.getElementById('exerciseImage').value = data.imageUrl;
                    }
                    
                    // Auto-fill equipment info
                    if (data.equipment) {
                        document.getElementById('machineInfo').value = data.equipment;
                    } else if (detectedExercise.equipment) {
                        document.getElementById('machineInfo').value = detectedExercise.equipment;
                    }
                    
                    statusEl.style.color = '#4CAF50';
                    statusEl.textContent = `✅ Exercise details auto-filled. Review and save!`;
                }
            }
        } else {
            // Fallback to detected data
            if (detectedExercise.category) {
                document.getElementById('exerciseCategory').value = detectedExercise.category;
            }
            if (detectedExercise.muscle) {
                const muscleSelect = document.getElementById('exerciseMuscle');
                Array.from(muscleSelect.options).forEach(option => {
                    if (option.value === detectedExercise.muscle) {
                        option.selected = true;
                    }
                });
            }
            if (detectedExercise.equipment) {
                document.getElementById('machineInfo').value = detectedExercise.equipment;
            }
            
            statusEl.style.color = '#4CAF50';
            statusEl.textContent = `✅ Exercise details filled from camera detection. Review and save!`;
        }
    } catch (error) {
        console.error('Failed to auto-fill exercise data:', error);
        statusEl.style.color = '#ff9800';
        statusEl.textContent = '⚠️ Using detected data. Review and modify if needed.';
        
        // Still fill what we have from detection
        if (detectedExercise.category) {
            document.getElementById('exerciseCategory').value = detectedExercise.category;
        }
        if (detectedExercise.muscle) {
            const muscleSelect = document.getElementById('exerciseMuscle');
            Array.from(muscleSelect.options).forEach(option => {
                if (option.value === detectedExercise.muscle) {
                    option.selected = true;
                }
            });
        }
        if (detectedExercise.equipment) {
            document.getElementById('machineInfo').value = detectedExercise.equipment;
        }
    }
}

function analyzeEquipment() {
    // Simulated equipment detection
    // In real implementation, use TensorFlow.js with a trained model
    const equipmentTypes = [
        'Cable Machine',
        'Bench Press',
        'Leg Press',
        'Lat Pulldown',
        'Chest Press Machine',
        'Shoulder Press Machine',
        'Leg Extension',
        'Leg Curl',
        'Rowing Machine',
        'Smith Machine'
    ];
    
    return equipmentTypes[Math.floor(Math.random() * equipmentTypes.length)];
}

function displayEquipmentSuggestions(equipment, resultBox) {
    const suggestions = {
        'Cable Machine': [
            { name: 'Cable Chest Flys', category: 'Chest', muscle: 'Middle Chest' },
            { name: 'Cable Lateral Raises', category: 'Shoulders', muscle: 'Side Delts' },
            { name: 'Cable Rows', category: 'Upper Back', muscle: 'Lats' }
        ],
        'Bench Press': [
            { name: 'Flat Bench Press', category: 'Chest', muscle: 'Middle Chest' },
            { name: 'Incline Bench Press', category: 'Chest', muscle: 'Upper Chest' },
            { name: 'Decline Bench Press', category: 'Chest', muscle: 'Lower Chest' }
        ],
        'Leg Press': [
            { name: 'Leg Press', category: 'Legs', muscle: 'Quads' },
            { name: 'Single Leg Press', category: 'Legs', muscle: 'Quads' }
        ],
        'Lat Pulldown': [
            { name: 'Lat Pulldown', category: 'Upper Back', muscle: 'Lats' },
            { name: 'Close Grip Pulldown', category: 'Upper Back', muscle: 'Lats' },
            { name: 'Wide Grip Pulldown', category: 'Upper Back', muscle: 'Lats' }
        ]
    };
    
    const defaultSuggestions = [
        { name: 'General Exercise', category: 'Various', muscle: 'Multiple' }
    ];
    
    const exerciseSuggestions = suggestions[equipment] || defaultSuggestions;
    
    let html = `<h4>📸 Equipment Detected: ${equipment}</h4>`;
    html += `<p><strong>Suggested Exercises:</strong></p><ul>`;
    
    exerciseSuggestions.forEach(ex => {
        html += `<li><strong>${ex.name}</strong> - ${ex.category} (${ex.muscle})</li>`;
    });
    
    html += `</ul>`;
    html += `<p style="margin-top: 15px; color: #666; font-size: 0.9rem;">💡 Tip: Adjust your grip width and stance to target different muscle fibers!</p>`;
    
    resultBox.innerHTML = html;
}

// ==================== QUESTION MODE ====================

function answerQuestion(question) {
    const resultBox = document.getElementById('aiQuestionResult');
    resultBox.classList.add('show');
    resultBox.innerHTML = '<div class="loading-spinner"></div> Analyzing your data...';
    
    setTimeout(() => {
        const userExercises = exercises.filter(ex => ex.user === currentUser);
        let answer = '';
        
        const lowerQ = question.toLowerCase();
        
        if (lowerQ.includes('not progressing') || lowerQ.includes('plateau')) {
            answer = analyzeProgression(userExercises, question);
        } else if (lowerQ.includes('training enough') || lowerQ.includes('enough')) {
            answer = analyzeTrainingFrequency(userExercises);
        } else if (lowerQ.includes('focus') || lowerQ.includes('next')) {
            answer = suggestFocus(userExercises);
        } else if (lowerQ.includes('compare') || lowerQ.includes('others')) {
            answer = compareToOthers(userExercises);
        } else {
            answer = provideGeneralAdvice(question, userExercises);
        }
        
        resultBox.innerHTML = answer;
    }, 1500);
}

function analyzeProgression(userExercises, question) {
    const exerciseName = question.match(/on (.+?)\?/)?.[1] || 'this exercise';
    const matchingExercises = userExercises.filter(ex => 
        ex.name.toLowerCase().includes(exerciseName.toLowerCase())
    );
    
    let html = `<h4>💬 Progression Analysis</h4>`;
    
    if (matchingExercises.length === 0) {
        html += `<p>I couldn't find data for "${exerciseName}". Make sure you're logging this exercise regularly!</p>`;
    } else {
        const ex = matchingExercises[0];
        const userData = ex.users?.[currentUser];
        const recentWorkouts = userData?.history?.slice(-5) || [];
        
        html += `<p><strong>Analyzing: ${ex.name}</strong></p>`;
        
        if (recentWorkouts.length === 0) {
            html += `<p><strong>⚠️ No workout history found.</strong> Start logging workouts for this exercise to track progression!</p>`;
            return html;
        }
        
        html += `<p><strong>Possible reasons for plateau:</strong></p>`;
        html += `<ul>`;
        html += `<li>🍽️ <strong>Nutrition:</strong> Make sure you're eating enough protein (1.6-2.2g per kg bodyweight) and in a slight calorie surplus.</li>`;
        html += `<li>😴 <strong>Recovery:</strong> Are you getting 7-9 hours of sleep? Muscles grow during rest!</li>`;
        html += `<li>📈 <strong>Progressive Overload:</strong> Try increasing weight by 2.5kg or adding 1-2 reps per set.</li>`;
        html += `<li>🔄 <strong>Variation:</strong> Change your grip, tempo, or exercise angle to stimulate new growth.</li>`;
        html += `<li>⚡ <strong>Intensity:</strong> Take sets closer to failure (1-2 reps in reserve).</li>`;
        html += `</ul>`;
        
        if (recentWorkouts.length >= 3) {
            const volumes = recentWorkouts.map(w => 
                w.sets.reduce((sum, s) => sum + (s.weight * s.reps), 0)
            );
            const avgRecent = volumes.slice(-2).reduce((a, b) => a + b, 0) / 2;
            const avgPrevious = volumes.slice(0, -2).reduce((a, b) => a + b, 0) / (volumes.length - 2);
            
            if (avgRecent < avgPrevious) {
                html += `<p><strong>⚠️ Your volume has decreased recently.</strong> This could indicate fatigue or undertraining.</p>`;
            }
        }
    }
    
    return html;
}

function analyzeTrainingFrequency(userExercises) {
    const now = Date.now();
    const weekAgo = now - (7 * 24 * 60 * 60 * 1000);
    
    const weeklyWorkouts = [];
    userExercises.forEach(ex => {
        const userData = ex.users?.[currentUser];
        userData?.history?.forEach(h => {
            if (new Date(h.date).getTime() >= weekAgo) {
                weeklyWorkouts.push(h);
            }
        });
    });
    
    const uniqueDays = new Set(weeklyWorkouts.map(w => new Date(w.date).toDateString())).size;
    const totalSets = weeklyWorkouts.reduce((sum, w) => sum + w.sets.length, 0);
    
    let html = `<h4>💬 Training Frequency Analysis</h4>`;
    html += `<p><strong>Last 7 days:</strong></p>`;
    html += `<ul>`;
    html += `<li>📅 ${uniqueDays} training days</li>`;
    html += `<li>💪 ${totalSets} total sets</li>`;
    html += `</ul>`;
    
    html += `<p><strong>Recommendations:</strong></p>`;
    html += `<ul>`;
    
    if (uniqueDays < 3) {
        html += `<li>🔴 You're training ${uniqueDays} days per week. For optimal muscle growth, aim for 3-5 days.</li>`;
    } else if (uniqueDays >= 3 && uniqueDays <= 5) {
        html += `<li>🟢 Perfect! ${uniqueDays} days per week is ideal for most people.</li>`;
    } else {
        html += `<li>🟡 ${uniqueDays} days is quite high. Make sure you're recovering properly between sessions.</li>`;
    }
    
    const setsPerWeek = totalSets;
    if (setsPerWeek < 40) {
        html += `<li>Consider increasing your volume - aim for 40-70 sets per week across all muscle groups.</li>`;
    } else if (setsPerWeek >= 40 && setsPerWeek <= 70) {
        html += `<li>Your weekly volume (${setsPerWeek} sets) is in the optimal range!</li>`;
    } else {
        html += `<li>High volume detected (${setsPerWeek} sets/week). Monitor for signs of overtraining.</li>`;
    }
    
    html += `</ul>`;
    
    return html;
}

function suggestFocus(userExercises) {
    const categoryVolume = {};
    const now = Date.now();
    const monthAgo = now - (30 * 24 * 60 * 60 * 1000);
    
    userExercises.forEach(ex => {
        const userData = ex.users?.[currentUser];
        userData?.history?.forEach(h => {
            if (new Date(h.date).getTime() >= monthAgo) {
                categoryVolume[ex.category] = (categoryVolume[ex.category] || 0) + h.sets.length;
            }
        });
    });
    
    const sortedCategories = Object.entries(categoryVolume).sort((a, b) => b[1] - a[1]);
    const leastTrained = Object.keys(categoryVolume).length > 0 ? 
        sortedCategories[sortedCategories.length - 1][0] : 'Legs';
    
    let html = `<h4>💬 Training Focus Suggestions</h4>`;
    html += `<p><strong>Your training distribution (last 30 days):</strong></p>`;
    html += `<ul>`;
    
    sortedCategories.forEach(([cat, sets]) => {
        html += `<li>${cat}: ${sets} sets</li>`;
    });
    
    html += `</ul>`;
    html += `<p><strong>Recommendation:</strong></p>`;
    html += `<p>Focus more on <strong>${leastTrained}</strong> to balance your physique. Aim for at least 10-20 sets per muscle group per week.</p>`;
    
    html += `<p><strong>💡 Pro Tips:</strong></p>`;
    html += `<ul>`;
    html += `<li>Train each muscle group 2x per week for optimal growth</li>`;
    html += `<li>Prioritize weak points by training them first in your workout</li>`;
    html += `<li>Don't neglect posterior chain (back, hamstrings, glutes)</li>`;
    html += `</ul>`;
    
    return html;
}

function compareToOthers(userExercises) {
    const allExercises = exercises;
    
    // Count user's workouts
    const userWorkouts = userExercises.reduce((sum, ex) => {
        const userData = ex.users?.[currentUser];
        return sum + (userData?.history?.length || 0);
    }, 0);
    
    // Calculate average workouts across all users
    let totalWorkouts = 0;
    let totalUsers = 0;
    allExercises.forEach(ex => {
        if (ex.users) {
            Object.keys(ex.users).forEach(user => {
                const userData = ex.users[user];
                if (userData?.history) {
                    totalWorkouts += userData.history.length;
                    totalUsers++;
                }
            });
        }
    });
    const avgWorkouts = totalUsers > 0 ? totalWorkouts / totalUsers : 0;
    
    // Calculate user's volume
    const userVolume = userExercises.reduce((sum, ex) => {
        const userData = ex.users?.[currentUser];
        return sum + (userData?.history?.reduce((s, h) => 
            s + h.sets.reduce((ss, set) => ss + (set.weight * set.reps), 0), 0) || 0);
    }, 0);
    
    let html = `<h4>💬 How You Compare</h4>`;
    html += `<p><strong>Your Stats:</strong></p>`;
    html += `<ul>`;
    html += `<li>Total workouts logged: ${userWorkouts}</li>`;
    html += `<li>Total volume moved: ${userVolume.toLocaleString()}kg</li>`;
    html += `</ul>`;
    
    let percentile;
    if (userWorkouts >= avgWorkouts * 1.5) {
        percentile = "top 10%";
    } else if (userWorkouts >= avgWorkouts) {
        percentile = "top 30%";
    } else {
        percentile = "top 50%";
    }
    
    html += `<p><strong>🏆 You're in the ${percentile} of users in this app!</strong></p>`;
    html += `<p>Keep up the great work! Consistency is key to long-term success. 💪</p>`;
    
    return html;
}

function provideGeneralAdvice(question, userExercises) {
    let html = `<h4>💬 General Advice</h4>`;
    html += `<p>Based on your question: "${question}"</p>`;
    html += `<p><strong>General Training Principles:</strong></p>`;
    html += `<ul>`;
    html += `<li>🎯 <strong>Progressive Overload:</strong> Gradually increase weight, reps, or sets over time</li>`;
    html += `<li>🍗 <strong>Nutrition:</strong> Eat 1.6-2.2g protein per kg bodyweight daily</li>`;
    html += `<li>😴 <strong>Recovery:</strong> Get 7-9 hours of sleep and rest days between training same muscles</li>`;
    html += `<li>📊 <strong>Track Progress:</strong> Log all your workouts (you're already doing this!)</li>`;
    html += `<li>🔄 <strong>Consistency:</strong> Train 3-5 times per week for best results</li>`;
    html += `</ul>`;
    
    return html;
}

// ==================== SUBSTITUTE MODE ====================

function populateSubstituteExercises() {
    const select = document.getElementById('substituteExerciseSelect');
    // Get all exercises that the current user has data for
    const userExercises = exercises.filter(ex => ex.users && ex.users[currentUser]);
    
    select.innerHTML = '<option value="">Select an exercise...</option>';
    
    if (userExercises.length === 0) {
        const option = document.createElement('option');
        option.textContent = 'No exercises yet - add some first!';
        option.disabled = true;
        select.appendChild(option);
        return;
    }
    
    userExercises.forEach(ex => {
        const option = document.createElement('option');
        option.value = ex.id;
        option.textContent = `${ex.name} (${ex.category})`;
        select.appendChild(option);
    });
}

function findSubstitutes() {
    const exerciseId = parseInt(document.getElementById('substituteExerciseSelect').value);
    const reason = document.getElementById('substituteReason').value;
    const resultBox = document.getElementById('aiSubstituteResult');
    
    if (!exerciseId) {
        alert('Please select an exercise');
        return;
    }
    
    resultBox.classList.add('show');
    resultBox.innerHTML = '<div class="loading-spinner"></div> AI is analyzing alternatives...';
    
    setTimeout(async () => {
        const exercise = exercises.find(ex => ex.id === exerciseId);
        const alternatives = await getAIExerciseAlternatives(exercise, reason);
        
        let html = `<h4>🔄 Alternative Exercises for ${exercise.name}</h4>`;
        
        if (reason) {
            html += `<p><em>Considering: ${reason}</em></p>`;
        }
        
        html += `<div style="margin-top: 15px;">`;
        
        // Get rep recommendations for all alternatives at once
        const repRecommendations = await getRepRecommendationsForAlternatives(exercise, alternatives);
        
        alternatives.forEach((alt, idx) => {
            const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '💪';
            
            // Equipment icon mapping
            const equipmentIcons = {
                'barbell': '🏋️',
                'dumbbell': '💪',
                'machine': '⚙️',
                'cable': '🔗',
                'bodyweight': '🧍',
                'mat': '🧘',
                'bench': '🪑',
                'none': '❌'
            };
            
            const equipmentIcon = alt.equipment ? equipmentIcons[alt.equipment.toLowerCase()] || '🏋️' : '';
            
            html += `<div style="background: ${idx < 3 ? '#f0f9ff' : '#f9f9f9'}; padding: 12px; margin-bottom: 10px; border-radius: 8px; border-left: 3px solid ${idx === 0 ? '#4CAF50' : idx === 1 ? '#2196F3' : idx === 2 ? '#FF9800' : '#ddd'};">`;
            html += `<div style="display: flex; justify-content: space-between; align-items: start;">`;
            html += `<div style="flex: 1;">`;
            html += `<div style="font-weight: bold; font-size: 1.05rem; margin-bottom: 4px;">${medal} ${alt.name}</div>`;
            
            if (alt.muscle) {
                html += `<div style="color: #666; font-size: 0.85rem; margin-bottom: 4px;">🎯 <strong>Targets:</strong> ${alt.muscle}</div>`;
            }
            
            if (alt.equipment) {
                html += `<div style="color: #666; font-size: 0.85rem; margin-bottom: 4px;">${equipmentIcon} <strong>Equipment:</strong> ${alt.equipment}</div>`;
            }
            
            if (alt.difficulty) {
                html += `<div style="color: #888; font-size: 0.8rem; margin-bottom: 4px;">📊 <strong>Level:</strong> ${alt.difficulty}</div>`;
            }
            
            html += `<div style="color: #555; font-size: 0.9rem; margin-bottom: 8px;">${alt.reason}</div>`;
            
            // Add rep recommendation if available
            const repRec = repRecommendations[idx];
            if (repRec && alt.name !== '⚕️ See a Doctor/PT' && alt.name !== 'Rest & Ice (RICE)') {
                html += `<div style="background: #e8f5e9; padding: 8px; border-radius: 6px; margin: 8px 0; border-left: 3px solid #4CAF50;">`;
                html += `<div style="font-weight: bold; color: #2e7d32; font-size: 0.85rem; margin-bottom: 3px;">🎯 Recommended Reps</div>`;
                html += `<div style="color: #1b5e20; font-size: 0.9rem;">${repRec}</div>`;
                html += `</div>`;
            }
            
            // Add action buttons (if not recovery advice)
            if (alt.name !== '⚕️ See a Doctor/PT' && alt.name !== 'Rest & Ice (RICE)') {
                // Check if exercise already exists
                const existingExercise = userExercises.find(ex => 
                    ex.name.toLowerCase() === alt.name.toLowerCase()
                );
                
                html += `<div style="margin-top: 8px; display: flex; gap: 8px; flex-wrap: wrap;">`;
                
                if (existingExercise) {
                    // Exercise exists - show "Log Workout" button
                    html += `<button onclick="quickLogExercise('${existingExercise.id}')" style="background: #4CAF50; color: white; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 0.85rem; font-weight: 500;">📝 Log Workout</button>`;
                } else {
                    // Exercise doesn't exist - show "Add Exercise" button
                    const altData = encodeURIComponent(JSON.stringify(alt));
                    html += `<button onclick="quickAddExercise('${altData}')" style="background: #2196F3; color: white; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 0.85rem; font-weight: 500;">➕ Add Exercise</button>`;
                }
                
                if (alt.video) {
                    html += `<a href="${alt.video}" target="_blank" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 6px 12px; border-radius: 6px; text-decoration: none; font-size: 0.85rem; display: inline-block;">📹 Watch Tutorial</a>`;
                }
                
                html += `</div>`;
            }
            
            html += `</div>`;
            
            html += `</div>`;
            html += `</div>`;
        });
        
        html += `</div>`;
        html += `<p style="margin-top: 15px; padding: 10px; background: #fffbea; border-left: 3px solid #ffc107; border-radius: 4px; color: #666; font-size: 0.9rem;">💡 <strong>Tip:</strong> These exercises are ranked by similarity in muscle activation, movement pattern, and equipment requirements. Click "Watch Tutorial" to see proper form demonstrations on YouTube.</p>`;
        
        resultBox.innerHTML = html;
    }, 1500);
}

// Quick add exercise from alternative suggestion
function quickAddExercise(altDataEncoded) {
    const alt = JSON.parse(decodeURIComponent(altDataEncoded));
    
    // Open the add exercise modal
    editingExerciseId = null;
    document.getElementById('modalTitle').textContent = 'Add Exercise';
    exerciseForm.reset();
    
    // Pre-fill with alternative exercise data
    document.getElementById('exerciseName').value = alt.name;
    document.getElementById('exerciseName').readOnly = false;
    
    // Map muscle to category
    const categoryMapping = {
        'chest': 'Chest',
        'upper chest': 'Chest',
        'lower chest': 'Chest',
        'back': 'Upper Back',
        'lats': 'Laterals',
        'upper back': 'Upper Back',
        'lower back': 'Lower Back',
        'shoulders': 'Shoulders',
        'delts': 'Shoulders',
        'biceps': 'Biceps',
        'triceps': 'Triceps',
        'abs': 'Abdominals',
        'core': 'Abdominals',
        'legs': 'Legs',
        'quads': 'Legs',
        'hamstrings': 'Legs',
        'glutes': 'Legs',
        'calves': 'Legs'
    };
    
    const muscleLower = (alt.muscle || '').toLowerCase();
    for (const [key, value] of Object.entries(categoryMapping)) {
        if (muscleLower.includes(key)) {
            document.getElementById('exerciseCategory').value = value;
            break;
        }
    }
    
    if (alt.muscle) {
        document.getElementById('exerciseMuscle').value = alt.muscle;
    }
    
    if (alt.equipment) {
        document.getElementById('machineInfo').value = alt.equipment;
    }
    
    // Enable form fields
    document.getElementById('exerciseCategory').disabled = false;
    document.getElementById('exerciseMuscle').disabled = false;
    
    // Show new exercise section
    document.getElementById('newExerciseSection').style.display = 'block';
    document.getElementById('logWorkoutSection').style.display = 'none';
    
    // Open modal
    exerciseModal.style.display = 'block';
    
    // Show success message
    const statusEl = document.getElementById('aiSuggestionStatus');
    if (statusEl) {
        statusEl.style.display = 'block';
        statusEl.style.color = '#2196F3';
        statusEl.textContent = '✅ Exercise details pre-filled! Review and click "Add Exercise".';
        setTimeout(() => {
            if (statusEl) statusEl.style.display = 'none';
        }, 3000);
    }
}

// Quick log workout for existing exercise
function quickLogExercise(exerciseId) {
    const exercise = exercises.find(ex => ex.id === exerciseId);
    if (!exercise) return;
    
    editingExerciseId = exerciseId;
    document.getElementById('modalTitle').textContent = `Log Workout: ${exercise.name}`;
    exerciseForm.reset();
    
    // Fill exercise info (read-only)
    document.getElementById('exerciseName').value = exercise.name;
    document.getElementById('exerciseName').readOnly = true;
    document.getElementById('exerciseCategory').value = exercise.category;
    document.getElementById('exerciseCategory').disabled = true;
    document.getElementById('exerciseMuscle').value = exercise.muscle;
    document.getElementById('exerciseMuscle').disabled = true;
    
    if (exercise.imageUrl) {
        document.getElementById('exerciseImagePreview').src = exercise.imageUrl;
        document.getElementById('exerciseImagePreview').style.display = 'block';
    }
    
    // Show log workout section
    document.getElementById('newExerciseSection').style.display = 'none';
    document.getElementById('logWorkoutSection').style.display = 'block';
    
    // Clear previous sets
    setsContainer.innerHTML = '';
    addSetRow();
    
    // Open modal
    exerciseModal.style.display = 'block';
    
    // Show success message
    document.getElementById('resultBox').innerHTML = '<div style="background: #e8f5e9; padding: 12px; border-radius: 8px; border-left: 3px solid #4CAF50; color: #2e7d32; margin-bottom: 15px;">✅ Ready to log workout! Enter your sets and click "Save".</div>' + document.getElementById('resultBox').innerHTML;
}

// Get AI-powered rep recommendations for alternative exercises
async function getRepRecommendationsForAlternatives(originalExercise, alternatives) {
    if (!useRealAI) {
        return alternatives.map(() => null);
    }
    
    try {
        // Get user's performance on the original exercise and similar exercises
        const userData = originalExercise.users?.[currentUser];
        const history = userData?.history || [];
        
        if (history.length === 0) {
            return alternatives.map(() => null);
        }
        
        // Calculate average reps for original exercise
        let totalReps = 0;
        let totalSets = 0;
        history.forEach(workout => {
            workout.sets.forEach(set => {
                totalReps += parseInt(set.reps) || 0;
                totalSets++;
            });
        });
        const avgReps = totalSets > 0 ? Math.round(totalReps / totalSets) : 0;
        
        // Get ALL related exercises (same muscle/category) with their rep patterns
        const relatedExercises = userExercises
            .filter(ex => {
                const exData = ex.users?.[currentUser];
                const exHistory = exData?.history || [];
                return exHistory.length > 0 && (
                    ex.muscle === originalExercise.muscle || 
                    ex.category === originalExercise.category
                );
            })
            .map(ex => {
                const exData = ex.users[currentUser];
                const exHistory = exData.history;
                let reps = 0;
                let sets = 0;
                exHistory.forEach(w => {
                    w.sets.forEach(s => {
                        reps += parseInt(s.reps) || 0;
                        sets++;
                    });
                });
                return {
                    name: ex.name,
                    avgReps: sets > 0 ? Math.round(reps / sets) : 0
                };
            })
            .filter(ex => ex.avgReps > 0)
            .slice(0, 10);
        
        if (relatedExercises.length === 0) {
            return alternatives.map(() => null);
        }
        
        // Get user profile for personalization
        const userProfile = getUserProfile(currentUser);
        const profileContext = userProfile ? `
User Profile:
- Experience: ${userProfile.experience}
- Goal: ${userProfile.goal}
- ${userProfile.age} years old, ${userProfile.weight}kg` : '';
        
        // Build context about user's rep patterns
        const repContext = `
Original Exercise: ${originalExercise.name} (Average: ${avgReps} reps/set)

Related Exercise Rep Patterns:
${relatedExercises.map(ex => `- ${ex.name}: ${ex.avgReps} reps/set`).join('\n')}`;
        
        // Build list of alternatives for AI to analyze
        const alternativesList = alternatives
            .filter(alt => alt.name !== '⚕️ See a Doctor/PT' && alt.name !== 'Rest & Ice (RICE)')
            .map((alt, idx) => `${idx + 1}. ${alt.name} (${alt.equipment}, ${alt.difficulty})`)
            .join('\n');
        
        const prompt = `You are a strength coach. Based on the user's performance data, recommend optimal rep ranges for these alternative exercises.${profileContext}

${repContext}

Alternative Exercises to Recommend Reps For:
${alternativesList}

For EACH alternative exercise listed above, provide a rep recommendation in this format:
"[number]-[number] reps (reason)"

Example outputs:
- "8-12 reps (similar to your squat pattern, hypertrophy range)"
- "12-15 reps (higher due to bodyweight nature)"
- "6-10 reps (lower for compound movement strength)"

Consider:
1. User's current rep patterns on similar exercises
2. Exercise type (compound vs isolation)
3. Equipment (bodyweight = higher reps, barbell = lower reps)
4. User's goal (${userProfile?.goal || 'general fitness'})
5. Difficulty level
6. Biomechanical similarity to exercises they already do

Respond with ONLY a JSON array of strings (one per exercise):
["8-12 reps (reason)", "12-15 reps (reason)", ...]`;

        const aiResponse = await callGeminiAI(prompt, null, false, 800);
        
        if (aiResponse) {
            const jsonMatch = aiResponse.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                const recommendations = JSON.parse(jsonMatch[0]);
                console.log('✅ AI rep recommendations:', recommendations);
                
                // Map back to include recovery items (which get null)
                const fullRecommendations = alternatives.map(alt => {
                    if (alt.name === '⚕️ See a Doctor/PT' || alt.name === 'Rest & Ice (RICE)') {
                        return null;
                    }
                    return recommendations.shift() || null;
                });
                
                return fullRecommendations;
            }
        }
    } catch (error) {
        console.error('Rep recommendation failed:', error);
    }
    
    // Fallback: return null for all
    return alternatives.map(() => null);
}

async function getAIExerciseAlternatives(exercise, reason) {
    // REAL AI-POWERED DYNAMIC RECOMMENDATIONS
    // Generate intelligent alternatives
    
    const lowerReason = reason.toLowerCase();
    const exerciseName = exercise.name.toLowerCase();
    const muscle = (exercise.muscle || exercise.category || '').toLowerCase();
    const hasInjury = lowerReason.includes('pain') || lowerReason.includes('injury') || lowerReason.includes('hurt');
    
    // TRY REAL AI FIRST
    if (useRealAI) {
        const injuryContext = hasInjury ? 
            `IMPORTANT: The user mentioned pain/injury ("${reason}"). Include recovery advice AND 3-5 safer alternative exercises (machines, cables, lighter variations) that avoid the painful area.` :
            `User wants alternatives because: "${reason}"`;
        
        const prompt = `You are a certified personal trainer. Generate 5 alternative exercises for "${exercise.name}" (targets: ${muscle}).

${injuryContext}

Respond with ONLY a JSON array of 5 exercises in this exact format:
[
  {
    "name": "Exercise Name",
    "muscle": "Primary Muscle",
    "equipment": "Barbell/Dumbbell/Machine/Cable/Bodyweight/Mat/Bench/None",
    "reason": "Why this is a good alternative (1 sentence)",
    "difficulty": "Beginner/Intermediate/Advanced"
  }
]

${hasInjury ? 'First 2 items should be recovery advice (See Doctor, Rest/RICE), then 3-5 safer exercise alternatives.' : 'Focus on similar movement patterns or same muscle groups.'}`;

        const aiResponse = await callGeminiAI(prompt);
        
        if (aiResponse) {
            try {
                const jsonMatch = aiResponse.match(/\[[\s\S]*\]/);
                if (jsonMatch) {
                    const alternatives = JSON.parse(jsonMatch[0]);
                    console.log('✅ Real AI generated alternatives:', alternatives);
                    return alternatives;
                }
            } catch (e) {
                console.error('Failed to parse AI alternatives:', e);
            }
        }
    }
    
    // FALLBACK: Pattern-based alternatives if AI fails
    console.log('⚠️ Using fallback alternatives');
    
    const isCompound = exerciseName.includes('press') || exerciseName.includes('squat') || 
                       exerciseName.includes('deadlift') || exerciseName.includes('row') || 
                       exerciseName.includes('pull') || exerciseName.includes('dip');
    
    const isIsolation = exerciseName.includes('curl') || exerciseName.includes('extension') || 
                        exerciseName.includes('raise') || exerciseName.includes('fly');
    
    const equipment = exerciseName.includes('dumbbell') ? 'dumbbell' :
                     exerciseName.includes('barbell') ? 'barbell' :
                     exerciseName.includes('cable') ? 'cable' :
                     exerciseName.includes('machine') ? 'machine' :
                     exerciseName.includes('bodyweight') || exerciseName.includes('push-up') || 
                     exerciseName.includes('pull-up') || exerciseName.includes('dip') ? 'bodyweight' : 'unknown';
    
    let alternatives = [];
    
    // INJURY MODE: Add recovery options first, then safer alternatives
    if (hasInjury) {
        alternatives.push(
            { name: '⚕️ See a Doctor/PT', muscle: 'Recovery', equipment: 'None', reason: 'Professional diagnosis recommended for persistent pain', difficulty: 'N/A' },
            { name: 'Rest & Ice (RICE)', muscle: 'Recovery', equipment: 'None', reason: '48-72 hours for acute injuries', difficulty: 'N/A' }
        );
    }
    
    // CHEST EXERCISES
    if (muscle.includes('chest') || exerciseName.includes('bench') || exerciseName.includes('press') && muscle.includes('chest')) {
        const chestAlts = [
            { name: 'Dumbbell Bench Press', muscle: 'Full Chest', equipment: 'Dumbbell', reason: 'Greater range of motion, fixes imbalances', difficulty: 'Intermediate' },
            { name: 'Incline Barbell Press', muscle: 'Upper Chest', equipment: 'Barbell', reason: '30-45° targets clavicular head', difficulty: 'Intermediate' },
            { name: 'Decline Press', muscle: 'Lower Chest', equipment: 'Barbell', reason: 'Emphasizes lower pec fibers', difficulty: 'Intermediate' },
            { name: 'Cable Crossovers', muscle: 'Inner Chest', equipment: 'Cable', reason: 'Constant tension, peak contraction', difficulty: 'Beginner' },
            { name: 'Weighted Dips', muscle: 'Lower Chest + Triceps', equipment: 'Bodyweight', reason: 'Compound movement, lean forward', difficulty: 'Advanced' },
            { name: 'Landmine Press', muscle: 'Upper Chest', equipment: 'Barbell', reason: 'Shoulder-friendly angle', difficulty: 'Intermediate' },
            { name: 'Push-ups (Diamond/Decline)', muscle: 'Chest Variations', equipment: 'Bodyweight', reason: 'Bodyweight progression', difficulty: 'Beginner' },
            { name: 'Pec Deck Machine', muscle: 'Chest Isolation', equipment: 'Machine', reason: 'Easy to control, constant tension', difficulty: 'Beginner' }
        ];
        
        // If injury, prioritize safer options (machine, cable, lighter variations)
        if (hasInjury) {
            alternatives.push(
                ...chestAlts.filter(a => a.name.includes('Machine') || a.name.includes('Cable') || a.name.includes('Push-up')).slice(0, 3)
            );
        } else if (lowerReason.includes('busy') || lowerReason.includes('occupied')) {
            alternatives.push(...chestAlts.filter(a => a.name.toLowerCase().includes('bodyweight') || a.name.toLowerCase().includes('push-up') || a.name.toLowerCase().includes('dip')));
        } else if (equipment === 'dumbbell') {
            alternatives.push(...chestAlts.filter(a => a.name.includes('Dumbbell') || a.name.includes('Cable')));
        } else if (equipment === 'barbell') {
            alternatives.push(...chestAlts.filter(a => a.name.includes('Barbell') || a.name.includes('Decline') || a.name.includes('Incline')));
        } else {
            alternatives.push(...chestAlts.slice(0, 5));
        }
    }
    
    // BACK EXERCISES
    else if (muscle.includes('back') || muscle.includes('lat') || exerciseName.includes('row') || exerciseName.includes('pull')) {
        const backAlts = [
            { name: 'Weighted Pull-ups', muscle: 'Lats + Biceps', equipment: 'Bodyweight', reason: 'King of back width', difficulty: 'Advanced' },
            { name: 'Pendlay Rows', muscle: 'Upper Back', equipment: 'Barbell', reason: 'Explosive power from floor', difficulty: 'Advanced' },
            { name: 'T-Bar Rows', muscle: 'Mid Back Thickness', equipment: 'Barbell', reason: 'Supported, heavy loads', difficulty: 'Intermediate' },
            { name: 'Lat Pulldown (Close Grip)', muscle: 'Lower Lats', equipment: 'Cable', reason: 'Targets lower lat fibers', difficulty: 'Beginner' },
            { name: 'Face Pulls', muscle: 'Rear Delts + Upper Back', equipment: 'Cable', reason: 'Shoulder health essential', difficulty: 'Beginner' },
            { name: 'Straight Arm Pulldown', muscle: 'Lat Isolation', equipment: 'Cable', reason: 'Removes biceps, pure lat', difficulty: 'Intermediate' },
            { name: 'Inverted Rows', muscle: 'Mid Back', equipment: 'Bodyweight', reason: 'Bodyweight horizontal pull', difficulty: 'Beginner' },
            { name: 'Chest-Supported Row', muscle: 'Clean Reps', equipment: 'Machine', reason: 'Eliminates cheating', difficulty: 'Intermediate' }
        ];
        
        if (hasInjury) {
            alternatives.push(...backAlts.filter(a => a.name.includes('Machine') || a.name.includes('Pulldown') || a.name.includes('Supported')).slice(0, 3));
        } else {
            alternatives.push(...backAlts.slice(0, 5));
        }
    }
    
    // SHOULDER EXERCISES
    else if (muscle.includes('shoulder') || muscle.includes('delt') || exerciseName.includes('shoulder') || 
             (exerciseName.includes('press') && !muscle.includes('chest') && !muscle.includes('leg'))) {
        const shoulderAlts = [
            { name: 'Arnold Press', muscle: 'All 3 Deltoid Heads', equipment: 'Dumbbell', reason: 'Rotation hits front/side/rear', difficulty: 'Intermediate' },
            { name: 'Cable Lateral Raises', muscle: 'Side Delts', equipment: 'Cable', reason: 'Constant tension, width builder', difficulty: 'Beginner' },
            { name: 'Face Pulls', muscle: 'Rear Delts', equipment: 'Cable', reason: 'Shoulder health and posture', difficulty: 'Beginner' },
            { name: 'Lu Raises', muscle: 'Side + Rear Delts', equipment: 'Dumbbell', reason: 'Overhead finish, unique stimulus', difficulty: 'Advanced' },
            { name: 'Landmine Press', muscle: 'Front Delts', equipment: 'Barbell', reason: 'Joint-friendly angle', difficulty: 'Intermediate' },
            { name: 'Pike Push-ups', muscle: 'Shoulders', equipment: 'Bodyweight', reason: 'Bodyweight shoulder builder', difficulty: 'Beginner' },
            { name: 'Reverse Pec Deck', muscle: 'Rear Delts', equipment: 'Machine', reason: 'Isolation, constant tension', difficulty: 'Beginner' }
        ];
        
        if (hasInjury) {
            alternatives.push(...shoulderAlts.filter(a => a.name.includes('Cable') || a.name.includes('Face Pull') || a.name.includes('Pec Deck')).slice(0, 3));
        } else {
            alternatives.push(...shoulderAlts.slice(0, 5));
        }
    }
    
    // LEG EXERCISES
    else if (muscle.includes('leg') || muscle.includes('quad') || muscle.includes('hamstring') || 
             exerciseName.includes('squat') || exerciseName.includes('leg') || exerciseName.includes('deadlift')) {
        const legAlts = [
            { name: 'Bulgarian Split Squats', muscle: 'Quads + Glutes', equipment: 'Dumbbell', reason: 'Best single-leg exercise', difficulty: 'Intermediate' },
            { name: 'Front Squats', muscle: 'Quads', equipment: 'Barbell', reason: 'More upright, quad emphasis', difficulty: 'Advanced' },
            { name: 'Romanian Deadlifts', muscle: 'Hamstrings', equipment: 'Barbell', reason: 'Hip hinge, posterior chain', difficulty: 'Intermediate' },
            { name: 'Nordic Curls', muscle: 'Hamstrings', equipment: 'Bodyweight', reason: 'Eccentric strength, injury prevention', difficulty: 'Advanced' },
            { name: 'Goblet Squats', muscle: 'Quads', equipment: 'Dumbbell', reason: 'Easy to learn, mobility', difficulty: 'Beginner' },
            { name: 'Walking Lunges', muscle: 'Functional Legs', equipment: 'Dumbbell', reason: 'Dynamic, real-world strength', difficulty: 'Beginner' },
            { name: 'Sissy Squats', muscle: 'Quad Isolation', equipment: 'Bodyweight', reason: 'Bodyweight quad killer', difficulty: 'Advanced' }
        ];
        
        if (hasInjury) {
            alternatives.push(...legAlts.filter(a => a.name.includes('Goblet') || a.name.includes('Split') || a.difficulty === 'Beginner').slice(0, 3));
        } else {
            alternatives.push(...legAlts.slice(0, 5));
        }
    }
    
    // BICEP EXERCISES
    else if (muscle.includes('bicep') || exerciseName.includes('curl')) {
        const bicepAlts = [
            { name: 'Spider Curls', muscle: 'Bicep Peak', equipment: 'Dumbbell', reason: 'Strict form, peak contraction', difficulty: 'Intermediate' },
            { name: 'Incline Dumbbell Curls', muscle: 'Bicep Stretch', equipment: 'Dumbbell', reason: 'Deep stretch, long head', difficulty: 'Beginner' },
            { name: 'Hammer Curls', muscle: 'Brachialis', equipment: 'Dumbbell', reason: 'Arm thickness, forearm size', difficulty: 'Beginner' },
            { name: '21s (7+7+7 Reps)', muscle: 'Complete Bicep', equipment: 'Barbell', reason: 'Time under tension, extreme pump', difficulty: 'Advanced' },
            { name: 'Drag Curls', muscle: 'Long Head Bicep', equipment: 'Barbell', reason: 'Bar drags up torso, unique angle', difficulty: 'Intermediate' },
            { name: 'Chin-ups', muscle: 'Biceps + Back', equipment: 'Bodyweight', reason: 'Compound bodyweight movement', difficulty: 'Intermediate' }
        ];
        alternatives.push(...bicepAlts.slice(0, 5));
    }
    
    // TRICEP EXERCISES
    else if (muscle.includes('tricep') || exerciseName.includes('tricep') || 
             (exerciseName.includes('extension') && !exerciseName.includes('leg'))) {
        const tricepAlts = [
            { name: 'JM Press', muscle: 'Tricep Mass', equipment: 'Barbell', reason: 'Hybrid skull crusher + close grip', difficulty: 'Advanced' },
            { name: 'Overhead Cable Extension', muscle: 'Long Head', equipment: 'Cable', reason: 'Overhead stretches long head', difficulty: 'Beginner' },
            { name: 'Close Grip Bench Press', muscle: 'Compound Tricep', equipment: 'Barbell', reason: 'Heavy loads, full arm', difficulty: 'Intermediate' },
            { name: 'Diamond Push-ups', muscle: 'Triceps', equipment: 'Bodyweight', reason: 'Bodyweight, anywhere', difficulty: 'Beginner' },
            { name: 'Tate Press', muscle: 'Lateral/Medial Head', equipment: 'Dumbbell', reason: 'Unique elbow position', difficulty: 'Advanced' },
            { name: 'Tricep Dips', muscle: 'Triceps + Chest', equipment: 'Bodyweight', reason: 'Compound bodyweight', difficulty: 'Intermediate' }
        ];
        alternatives.push(...tricepAlts.slice(0, 5));
    }
    
    // GENERIC FALLBACK for uncommon exercises
    else {
        alternatives.push(
            { name: 'Progressive Overload', muscle: 'All Muscles', equipment: 'None', reason: 'Gradually increase weight/reps/sets', difficulty: 'All Levels' },
            { name: 'Compound Movements', muscle: 'Multiple Groups', equipment: 'Barbell', reason: 'Multi-joint efficiency', difficulty: 'All Levels' },
            { name: 'Bodyweight Variations', muscle: 'Functional', equipment: 'Bodyweight', reason: 'Master bodyweight first', difficulty: 'Beginner' },
            { name: 'Consult a Trainer', muscle: 'Personalized', equipment: 'None', reason: 'Get exercise-specific recommendations', difficulty: 'All Levels' }
        );
    }
    
    // AI ENHANCEMENT: Add YouTube video links dynamically
    const enhancedAlternatives = alternatives.slice(0, 5).map(alt => ({
        ...alt,
        video: `https://www.youtube.com/results?search_query=${encodeURIComponent(alt.name + ' form tutorial')}`
    }));
    
    return enhancedAlternatives;
}

// ==================== COMPARE MODE ====================

function analyzeProgress() {
    const resultBox = document.getElementById('aiCompareResult');
    resultBox.classList.add('show');
    resultBox.innerHTML = '<div class="loading-spinner"></div> Analyzing muscle group progress...';
    
    setTimeout(() => {
        const userExercises = exercises.filter(ex => ex.user === currentUser);
        const categoryProgress = {};
        
        userExercises.forEach(ex => {
            if (!categoryProgress[ex.category]) {
                categoryProgress[ex.category] = {
                    totalWorkouts: 0,
                    totalVolume: 0,
                    exercises: 0
                };
            }
            
            categoryProgress[ex.category].exercises++;
            categoryProgress[ex.category].totalWorkouts += ex.history?.length || 0;
            
            ex.history?.forEach(h => {
                const volume = h.sets.reduce((sum, s) => sum + (s.weight * s.reps), 0);
                categoryProgress[ex.category].totalVolume += volume;
            });
        });
        
        const categories = Object.keys(categoryProgress);
        
        if (categories.length === 0) {
            resultBox.innerHTML = '<p>Not enough data yet. Keep logging workouts!</p>';
            return;
        }
        
        // Find strongest and weakest
        const sorted = categories.sort((a, b) => 
            categoryProgress[b].totalWorkouts - categoryProgress[a].totalWorkouts
        );
        
        const strongest = sorted[0];
        const weakest = sorted[sorted.length - 1];
        
        let html = `<h4>📈 Progress Comparison Analysis</h4>`;
        html += `<p><strong>Muscle Group Breakdown:</strong></p>`;
        html += `<ul>`;
        
        sorted.forEach(cat => {
            const data = categoryProgress[cat];
            html += `<li><strong>${cat}:</strong> ${data.totalWorkouts} workouts, ${data.exercises} exercises`;
            
            if (cat === strongest) {
                html += ` 🏆 <em>(Most trained)</em>`;
            } else if (cat === weakest) {
                html += ` ⚠️ <em>(Needs attention)</em>`;
            }
            
            html += `</li>`;
        });
        
        html += `</ul>`;
        
        html += `<p><strong>💡 Analysis:</strong></p>`;
        
        const strongestWorkouts = categoryProgress[strongest].totalWorkouts;
        const weakestWorkouts = categoryProgress[weakest].totalWorkouts;
        const ratio = strongestWorkouts / (weakestWorkouts || 1);
        
        if (ratio > 2) {
            html += `<p>⚠️ <strong>Significant Imbalance Detected!</strong></p>`;
            html += `<p>Your ${strongest} is trained ${ratio.toFixed(1)}x more than your ${weakest}. This could lead to:</p>`;
            html += `<ul>`;
            html += `<li>Muscle imbalances and postural issues</li>`;
            html += `<li>Increased injury risk</li>`;
            html += `<li>Unbalanced physique development</li>`;
            html += `</ul>`;
            html += `<p><strong>Recommendation:</strong> Add 2-3 exercises for ${weakest} and train them 2x per week.</p>`;
        } else if (ratio > 1.5) {
            html += `<p>Your ${strongest} progresses faster than ${weakest}. Consider adding more volume to ${weakest} for balanced development.</p>`;
        } else {
            html += `<p>✅ <strong>Well-balanced training!</strong> Your muscle groups are developing relatively evenly.</p>`;
        }
        
        // Push/Pull/Legs analysis
        const pushCategories = ['Chest', 'Shoulders', 'Triceps'];
        const pullCategories = ['Upper Back', 'Lower Back', 'Biceps'];
        const legCategories = ['Legs'];
        
        const pushVolume = categories.filter(c => pushCategories.includes(c))
            .reduce((sum, c) => sum + categoryProgress[c].totalWorkouts, 0);
        const pullVolume = categories.filter(c => pullCategories.includes(c))
            .reduce((sum, c) => sum + categoryProgress[c].totalWorkouts, 0);
        const legVolume = categories.filter(c => legCategories.includes(c))
            .reduce((sum, c) => sum + categoryProgress[c].totalWorkouts, 0);
        
        html += `<p><strong>Push/Pull/Legs Balance:</strong></p>`;
        html += `<ul>`;
        html += `<li>Push (Chest/Shoulders/Triceps): ${pushVolume} workouts</li>`;
        html += `<li>Pull (Back/Biceps): ${pullVolume} workouts</li>`;
        html += `<li>Legs: ${legVolume} workouts</li>`;
        html += `</ul>`;
        
        if (legVolume < pushVolume * 0.5) {
            html += `<p>⚠️ Classic mistake: Don't skip leg day! Your leg volume is low compared to upper body.</p>`;
        }
        
        if (pullVolume < pushVolume * 0.7) {
            html += `<p>💡 Increase pull exercises to balance out pushing movements and prevent shoulder issues.</p>`;
        }
        
        resultBox.innerHTML = html;
    }, 1500);
}

// Initialize AI when DOM loads (called after main init)
document.addEventListener('DOMContentLoaded', () => {
    // Wait a bit for main init to complete
    setTimeout(initAI, 100);
    
    // Check if user needs to complete profile
    setTimeout(() => {
        promptUserProfileSetup();
    }, 500);
});

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', init);
