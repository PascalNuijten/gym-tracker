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
let currentUser = 'Fran';
let exercises = [];
let editingExerciseId = null;
let setCounter = 1;
let currentChart = null;

// DOM Elements
const userButtons = document.querySelectorAll('.user-btn');
const addExerciseBtn = document.getElementById('addExerciseBtn');
const modal = document.getElementById('exerciseModal');
const closeModal = document.querySelector('.close');
const cancelBtn = document.getElementById('cancelBtn');
const exerciseForm = document.getElementById('exerciseForm');
const exerciseList = document.getElementById('exerciseList');
const categoryFilter = document.getElementById('categoryFilter');
const muscleFilter = document.getElementById('muscleFilter');
const searchInput = document.getElementById('searchInput');

// Initialize App
function init() {
    setupEventListeners();
    setupFirebaseListeners();
}

// Event Listeners
function setupEventListeners() {
    // User Toggle
    userButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            userButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentUser = btn.dataset.user;
            renderExercises();
        });
    });

    // Add Exercise Button
    addExerciseBtn.addEventListener('click', () => {
        editingExerciseId = null;
        document.getElementById('modalTitle').textContent = 'Add New Exercise';
        exerciseForm.reset();
        resetSetsContainer();
        
        // Enable form fields
        document.getElementById('exerciseName').readOnly = false;
        document.getElementById('exerciseCategory').disabled = false;
        document.getElementById('exerciseMuscle').disabled = false;
        
        modal.style.display = 'block';
    });

    // Close Modal
    closeModal.addEventListener('click', () => {
        modal.style.display = 'none';
    });

    cancelBtn.addEventListener('click', () => {
        modal.style.display = 'none';
    });

    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });

    // Form Submit
    exerciseForm.addEventListener('submit', (e) => {
        e.preventDefault();
        saveExercise();
    });

    // Add Set Button
    document.getElementById('addSetBtn').addEventListener('click', addSet);

    // Filters
    categoryFilter.addEventListener('change', renderExercises);
    muscleFilter.addEventListener('change', renderExercises);
    searchInput.addEventListener('input', renderExercises);
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
                <input type="number" id="set${setCounter}_reps" class="set-reps" min="0" placeholder="12">
            </div>
            <div class="form-group">
                <label for="set${setCounter}_weight">Weight (kg)</label>
                <input type="number" id="set${setCounter}_weight" class="set-weight" min="0" step="0.5" placeholder="50">
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

// Save Exercise
function saveExercise() {
    const sets = getSetsFromForm();
    const notes = document.getElementById('exerciseNotes').value;

    const exercise = {
        id: editingExerciseId || Date.now(),
        name: document.getElementById('exerciseName').value,
        category: document.getElementById('exerciseCategory').value,
        muscle: document.getElementById('exerciseMuscle').value,
        image: document.getElementById('exerciseImage').value,
        machineInfo: document.getElementById('machineInfo').value,
        users: {
            Fran: { history: [] },
            Pascal: { history: [] },
            Cicci: { history: [] }
        }
    };

    // If editing existing exercise, preserve all user data
    if (editingExerciseId) {
        const existingExercise = exercises.find(ex => ex.id === editingExerciseId);
        if (existingExercise) {
            exercise.users = existingExercise.users;
        }
    }

    // Add new workout session to current user's history
    if (sets.length > 0) {
        const session = {
            date: new Date().toISOString(),
            sets: sets,
            notes: notes
        };
        
        if (!exercise.users[currentUser].history) {
            exercise.users[currentUser].history = [];
        }
        exercise.users[currentUser].history.push(session);
    }

    if (editingExerciseId) {
        const index = exercises.findIndex(ex => ex.id === editingExerciseId);
        exercises[index] = exercise;
    } else {
        exercises.push(exercise);
    }

    saveToFirebase();
    modal.style.display = 'none';
    exerciseForm.reset();
}

// Edit Exercise (add new session)
function editExercise(id) {
    const exercise = exercises.find(ex => ex.id === id);
    if (!exercise) return;

    editingExerciseId = id;
    document.getElementById('modalTitle').textContent = 'Log Workout - ' + exercise.name;
    
    // Fill form with exercise data (read-only fields)
    document.getElementById('exerciseName').value = exercise.name;
    document.getElementById('exerciseCategory').value = exercise.category;
    document.getElementById('exerciseMuscle').value = exercise.muscle;
    document.getElementById('exerciseImage').value = exercise.image || '';
    document.getElementById('machineInfo').value = exercise.machineInfo || '';
    
    // Make basic fields read-only when editing
    document.getElementById('exerciseName').readOnly = true;
    document.getElementById('exerciseCategory').disabled = true;
    document.getElementById('exerciseMuscle').disabled = true;
    
    // Reset sets for new workout
    resetSetsContainer();
    document.getElementById('exerciseNotes').value = '';

    modal.style.display = 'block';
}

// Delete Exercise
function deleteExercise(id) {
    if (confirm('Are you sure you want to delete this exercise and all its history?')) {
        exercises = exercises.filter(ex => ex.id !== id);
        saveToFirebase();
    }
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

// Generate Improvement Suggestion
function generateSuggestion(history) {
    if (!history || history.length === 0) {
        return "Start with a comfortable weight and aim for 8-12 reps per set.";
    }

    const lastSession = history[history.length - 1];
    const lastSets = lastSession.sets;
    const avgWeight = lastSets.reduce((sum, set) => sum + set.weight, 0) / lastSets.length;
    const avgReps = lastSets.reduce((sum, set) => sum + set.reps, 0) / lastSets.length;

    // Progressive overload logic
    if (avgReps >= 12) {
        const newWeight = Math.round((avgWeight * 1.05) * 2) / 2; // 5% increase, rounded to 0.5kg
        return `Great progress! Try increasing weight to ${newWeight}kg and aim for 8-10 reps.`;
    } else if (avgReps >= 8) {
        return `You're in the optimal range! Try adding 1-2 more reps or increase weight by 2.5kg.`;
    } else if (avgReps < 6) {
        const newWeight = Math.round((avgWeight * 0.9) * 2) / 2; // 10% decrease
        return `Consider reducing weight to ${newWeight}kg to hit 8-10 reps with good form.`;
    } else {
        return `Keep the current weight and aim to increase reps to 8-10.`;
    }
}

// Show Exercise Details Modal
function showExerciseDetails(id) {
    const exercise = exercises.find(ex => ex.id === id);
    if (!exercise) return;

    const userData = exercise.users[currentUser];
    const history = userData.history || [];
    const stats = calculateStats(history);

    // Create details modal
    const detailsModal = document.createElement('div');
    detailsModal.className = 'modal';
    detailsModal.style.display = 'block';
    detailsModal.innerHTML = `
        <div class="modal-content" style="max-width: 900px;">
            <span class="close" onclick="this.parentElement.parentElement.remove()">&times;</span>
            <h2>${exercise.name} - ${currentUser}'s Progress</h2>
            
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
                <p>${generateSuggestion(history)}</p>
            </div>

            <div class="chart-container">
                <canvas id="progressChart"></canvas>
            </div>

            <div class="history-section">
                <h3>Workout History</h3>
                <div class="history-list">
                    ${history.length > 0 ? history.map((session, idx) => `
                        <div class="history-item">
                            <div class="history-date">${new Date(session.date).toLocaleDateString()} ${new Date(session.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                            <div class="history-sets">
                                ${session.sets.map((set, i) => `
                                    <span class="set-badge">Set ${i+1}: ${set.reps} reps @ ${set.weight}kg</span>
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
        
        return matchCategory && matchMuscle && matchSearch;
    });

    if (filtered.length === 0) {
        exerciseList.innerHTML = `
            <div class="empty-state">
                <h2>No exercises found</h2>
                <p>Add your first exercise or adjust your filters</p>
            </div>
        `;
        return;
    }

    exerciseList.innerHTML = filtered.map(exercise => {
        const userData = exercise.users[currentUser];
        const history = userData.history || [];
        const stats = calculateStats(history);
        
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
                    </div>
                    
                    <div class="progress-section">
                        <div class="progress-stats">
                            <div class="stat">
                                <div class="stat-label">Last Workout</div>
                                <div class="stat-value">${stats.lastReps ? stats.lastReps + ' reps' : '-'}</div>
                                <div class="stat-sublabel">${stats.lastWeight ? stats.lastWeight + ' kg' : ''}</div>
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
                        <button class="btn-delete" onclick="deleteExercise(${exercise.id})">🗑️</button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// Firebase Database Functions
function setupFirebaseListeners() {
    if (!database) return;
    
    const exercisesRef = database.ref('exercises');
    
    // Listen for changes in real-time
    exercisesRef.on('value', (snapshot) => {
        const data = snapshot.val();
        if (data) {
            exercises = data;
        } else {
            // Initialize with sample data
            exercises = [
                {
                    id: Date.now(),
                    name: 'Barbell Squat',
                    category: 'Legs',
                    muscle: 'Quadriceps',
                    image: '',
                    machineInfo: 'Squat Rack',
                    users: {
                        Fran: { 
                            history: [
                                {
                                    date: new Date(Date.now() - 7*24*60*60*1000).toISOString(),
                                    sets: [{reps: 10, weight: 80}, {reps: 10, weight: 80}, {reps: 8, weight: 80}],
                                    notes: 'Felt strong!'
                                },
                                {
                                    date: new Date().toISOString(),
                                    sets: [{reps: 12, weight: 80}, {reps: 10, weight: 80}, {reps: 10, weight: 80}],
                                    notes: 'Good form'
                                }
                            ]
                        },
                        Pascal: { 
                            history: [
                                {
                                    date: new Date().toISOString(),
                                    sets: [{reps: 12, weight: 70}, {reps: 10, weight: 70}, {reps: 9, weight: 70}],
                                    notes: ''
                                }
                            ]
                        },
                        Cicci: { history: [] }
                    }
                }
            ];
            saveToFirebase();
        }
        renderExercises();
    }, (error) => {
        console.error('Firebase read error:', error);
        alert('Error loading data. Check your internet connection.');
    });
}

function saveToFirebase() {
    if (!database) return;
    
    database.ref('exercises').set(exercises)
        .then(() => {
            console.log('Data saved to Firebase');
        })
        .catch((error) => {
            console.error('Firebase save error:', error);
            alert('Error saving data. Check your internet connection.');
        });
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', init);
