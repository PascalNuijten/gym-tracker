// Firebase Configuration
// IMPORTANT: Replace with your own Firebase config after setup
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

    // Filters
    categoryFilter.addEventListener('change', renderExercises);
    muscleFilter.addEventListener('change', renderExercises);
    searchInput.addEventListener('input', renderExercises);
}

// Save Exercise
function saveExercise() {
    const exercise = {
        id: editingExerciseId || Date.now(),
        name: document.getElementById('exerciseName').value,
        category: document.getElementById('exerciseCategory').value,
        muscle: document.getElementById('exerciseMuscle').value,
        image: document.getElementById('exerciseImage').value,
        machineInfo: document.getElementById('machineInfo').value,
        users: {
            Fran: {
                reps: 0,
                weight: 0,
                notes: ''
            },
            Pascal: {
                reps: 0,
                weight: 0,
                notes: ''
            }
        }
    };

    // If editing existing exercise, preserve other user's data
    if (editingExerciseId) {
        const existingExercise = exercises.find(ex => ex.id === editingExerciseId);
        if (existingExercise) {
            exercise.users = existingExercise.users;
        }
    }

    // Update current user's progress
    const reps = document.getElementById('exerciseReps').value;
    const weight = document.getElementById('exerciseWeight').value;
    const notes = document.getElementById('exerciseNotes').value;

    exercise.users[currentUser] = {
        reps: reps ? parseInt(reps) : 0,
        weight: weight ? parseFloat(weight) : 0,
        notes: notes
    };

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

// Edit Exercise
function editExercise(id) {
    const exercise = exercises.find(ex => ex.id === id);
    if (!exercise) return;

    editingExerciseId = id;
    document.getElementById('modalTitle').textContent = 'Edit Exercise';
    
    // Fill form with exercise data
    document.getElementById('exerciseName').value = exercise.name;
    document.getElementById('exerciseCategory').value = exercise.category;
    document.getElementById('exerciseMuscle').value = exercise.muscle;
    document.getElementById('exerciseImage').value = exercise.image || '';
    document.getElementById('machineInfo').value = exercise.machineInfo || '';
    
    // Fill current user's progress
    const userData = exercise.users[currentUser];
    document.getElementById('exerciseReps').value = userData.reps || '';
    document.getElementById('exerciseWeight').value = userData.weight || '';
    document.getElementById('exerciseNotes').value = userData.notes || '';

    modal.style.display = 'block';
}

// Delete Exercise
function deleteExercise(id) {
    if (confirm('Are you sure you want to delete this exercise?')) {
        exercises = exercises.filter(ex => ex.id !== id);
        saveToFirebase();
    }
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
                                <div class="stat-label">Reps</div>
                                <div class="stat-value">${userData.reps || '-'}</div>
                            </div>
                            <div class="stat">
                                <div class="stat-label">Weight (kg)</div>
                                <div class="stat-value">${userData.weight || '-'}</div>
                            </div>
                        </div>
                        ${userData.notes ? `<div class="notes">💭 ${userData.notes}</div>` : ''}
                    </div>
                    
                    <div class="exercise-actions">
                        <button class="btn-edit" onclick="editExercise(${exercise.id})">✏️ Edit</button>
                        <button class="btn-delete" onclick="deleteExercise(${exercise.id})">🗑️ Delete</button>
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
            // Initialize with sample data if database is empty
            exercises = [
                {
                    id: Date.now(),
                    name: 'Barbell Squat',
                    category: 'Legs',
                    muscle: 'Quadriceps',
                    image: '',
                    machineInfo: 'Squat Rack',
                    users: {
                        Fran: { reps: 10, weight: 80, notes: 'Felt strong today!' },
                        Pascal: { reps: 12, weight: 70, notes: 'Good form' }
                    }
                },
                {
                    id: Date.now() + 1,
                    name: 'Bench Press',
                    category: 'Chest',
                    muscle: 'Chest',
                    image: '',
                    machineInfo: 'Flat Bench',
                    users: {
                        Fran: { reps: 8, weight: 60, notes: '' },
                        Pascal: { reps: 10, weight: 55, notes: 'Need spotter next time' }
                    }
                },
                {
                    id: Date.now() + 2,
                    name: 'Deadlift',
                    category: 'Back/Shoulder',
                    muscle: 'Back',
                    image: '',
                    machineInfo: 'Barbell',
                    users: {
                        Fran: { reps: 5, weight: 100, notes: 'PR attempt next week' },
                        Pascal: { reps: 6, weight: 90, notes: '' }
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
