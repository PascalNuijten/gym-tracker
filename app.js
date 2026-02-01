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
        
        // Show new exercise section by default
        document.getElementById('newExerciseSection').style.display = 'block';
        document.getElementById('existingExerciseSection').style.display = 'none';
        document.getElementById('newExerciseBtn').classList.add('active');
        document.getElementById('existingExerciseBtn').classList.remove('active');
        
        // Show option toggle
        document.querySelector('.exercise-option-toggle').parentElement.style.display = 'block';
        
        // Show sets section
        document.getElementById('setsContainer').parentElement.style.display = 'block';
        document.getElementById('addSetBtn').style.display = 'block';
        document.querySelector('label[for="exerciseNotes"]').parentElement.style.display = 'block';
        
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
        
        // Make exercise name not required when selecting existing
        document.getElementById('exerciseName').required = false;
        document.getElementById('exerciseCategory').required = false;
        document.getElementById('exerciseMuscle').required = false;
    });

    document.getElementById('newExerciseBtn').addEventListener('click', () => {
        document.getElementById('newExerciseSection').style.display = 'block';
        document.getElementById('existingExerciseSection').style.display = 'none';
        document.getElementById('newExerciseBtn').classList.add('active');
        document.getElementById('existingExerciseBtn').classList.remove('active');
        
        // Make exercise name required when creating new
        document.getElementById('exerciseName').required = true;
        document.getElementById('exerciseCategory').required = true;
        document.getElementById('exerciseMuscle').required = true;
    });

    // When selecting an existing exercise, update the form
    document.getElementById('existingExerciseSelect').addEventListener('change', (e) => {
        const exerciseId = parseInt(e.target.value);
        if (exerciseId) {
            const exercise = exercises.find(ex => ex.id === exerciseId);
            if (exercise) {
                editingExerciseId = exerciseId;
            }
        } else {
            editingExerciseId = null;
        }
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
    
    // Generate Routine Button
    document.getElementById('generateRoutineBtn').addEventListener('click', generateWeeklyRoutine);
    
    // Add User Button
    document.getElementById('addUserBtn').addEventListener('click', showAddUserModal);
    
    // Weekly Summary Button
    document.getElementById('weeklySummaryBtn').addEventListener('click', showWeeklySummary);
    
    // Debug Button
    document.getElementById('debugBtn').addEventListener('click', showDebugModal);
}

// Show Debug Modal - View All Database Exercises
function showDebugModal() {
    const debugModal = document.createElement('div');
    debugModal.className = 'modal';
    debugModal.style.display = 'block';
    
    let debugHTML = '<h3>All Exercises in Database</h3>';
    debugHTML += `<p>Total exercises: ${exercises.length}</p>`;
    debugHTML += '<div style="max-height: 500px; overflow-y: auto;">';
    
    exercises.forEach((ex, idx) => {
        const allUsers = Object.keys(ex.users);
        const usersWithHistory = allUsers.filter(user => 
            ex.users[user].history && ex.users[user].history.length > 0
        );
        
        debugHTML += `
            <div style="border: 1px solid #ddd; padding: 10px; margin: 10px 0; border-radius: 5px;">
                <strong>${idx + 1}. ${ex.name}</strong><br>
                <small>Category: ${ex.category} | Muscle: ${ex.muscle}</small><br>
                <small>ID: ${ex.id}</small><br>
                <small>All users in object: ${allUsers.join(', ')}</small><br>
                <small style="color: ${usersWithHistory.length > 0 ? 'green' : 'red'};">Users with history: ${usersWithHistory.length > 0 ? usersWithHistory.join(', ') : 'NONE'}</small><br>
        `;
        
        // Show detailed history for each user
        allUsers.forEach(user => {
            const historyCount = ex.users[user]?.history?.length || 0;
            debugHTML += `<small>- ${user}: ${historyCount} workout(s)</small><br>`;
        });
        
        debugHTML += '</div>';
    });
    
    debugHTML += '</div>';
    
    debugModal.innerHTML = `
        <div class="modal-content" style="max-width: 800px;">
            <span class="close" onclick="this.parentElement.parentElement.remove()">&times;</span>
            <h2>🔍 Database Debug Info</h2>
            ${debugHTML}
        </div>
    `;
    
    document.body.appendChild(debugModal);
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

// Populate Existing Exercises Dropdown
function populateExistingExercises() {
    const select = document.getElementById('existingExerciseSelect');
    select.innerHTML = '<option value="">Choose an exercise...</option>';
    
    console.log('Total exercises in database:', exercises.length);
    console.log('Current user:', currentUser);
    
    // Get all exercises that current user hasn't done yet
    // This includes exercises done by other users OR exercises with no history at all
    const availableExercises = exercises.filter(ex => {
        const currentUserHistory = ex.users[currentUser]?.history || [];
        const available = currentUserHistory.length === 0;
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

// Save Exercise
function saveExercise() {
    const sets = getSetsFromForm();
    const notes = document.getElementById('exerciseNotes').value;
    
    // Check if this is editing exercise details by checking if sets section is hidden
    const setsContainer = document.getElementById('setsContainer');
    const addSetBtn = document.getElementById('addSetBtn');
    const isSetsHidden = setsContainer.style.display === 'none' || addSetBtn.style.display === 'none';
    
    if (isSetsHidden && editingExerciseId) {
        // Just updating exercise details (sets section is hidden)
        const exercise = exercises.find(ex => ex.id === editingExerciseId);
        if (exercise) {
            exercise.name = document.getElementById('exerciseName').value;
            exercise.category = document.getElementById('exerciseCategory').value;
            exercise.muscle = document.getElementById('exerciseMuscle').value;
            exercise.image = document.getElementById('exerciseImage').value;
            exercise.machineInfo = document.getElementById('machineInfo').value;
            
            saveToFirebase();
            modal.style.display = 'none';
            exerciseForm.reset();
            editingExerciseId = null;
            
            // Reset visibility for next use
            setsContainer.style.display = '';
            const workoutHeading = setsContainer.previousElementSibling;
            if (workoutHeading && workoutHeading.tagName === 'H3') {
                workoutHeading.style.display = '';
            }
            addSetBtn.style.display = '';
            const notesParent = document.querySelector('label[for="exerciseNotes"]')?.parentElement;
            if (notesParent) notesParent.style.display = '';
            const optionToggleParent = document.querySelector('.exercise-option-toggle')?.parentElement;
            if (optionToggleParent) optionToggleParent.style.display = '';
        }
        return;
    }
    
    // Check if we need any sets for workout logging
    if (sets.length === 0) {
        alert('Please add at least one set with reps and weight.');
        return;
    }

    let exercise;
    const isExistingExercise = document.getElementById('existingExerciseSection').style.display !== 'none';
    
    if (isExistingExercise && editingExerciseId) {
        // Adding workout to existing exercise that user hasn't done before
        exercise = exercises.find(ex => ex.id === editingExerciseId);
        if (!exercise) {
            alert('Exercise not found!');
            return;
        }
        
        // Ensure current user has a history array
        if (!exercise.users[currentUser]) {
            exercise.users[currentUser] = { history: [] };
        }
    } else if (editingExerciseId && !isExistingExercise) {
        // Logging new workout to existing exercise (from "Log Workout" button)
        exercise = exercises.find(ex => ex.id === editingExerciseId);
        if (!exercise) {
            alert('Exercise not found!');
            return;
        }
    } else {
        // Creating brand new exercise
        exercise = {
            id: Date.now(),
            name: document.getElementById('exerciseName').value,
            category: document.getElementById('exerciseCategory').value,
            muscle: document.getElementById('exerciseMuscle').value,
            image: document.getElementById('exerciseImage').value,
            machineInfo: document.getElementById('machineInfo').value,
            users: {}
        };
        
        // Initialize all users
        users.forEach(user => {
            exercise.users[user] = { history: [] };
        });
        
        // Add to exercises array
        exercises.push(exercise);
    }

    // Add new workout session to current user's history
    const session = {
        date: new Date().toISOString(),
        sets: sets,
        notes: notes
    };
    
    if (!exercise.users[currentUser]) {
        exercise.users[currentUser] = { history: [] };
    }
    if (!exercise.users[currentUser].history) {
        exercise.users[currentUser].history = [];
    }
    exercise.users[currentUser].history.push(session);

    saveToFirebase();
    modal.style.display = 'none';
    exerciseForm.reset();
    editingExerciseId = null;
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
    
    // Make basic fields read-only when logging workout
    document.getElementById('exerciseName').readOnly = true;
    document.getElementById('exerciseCategory').disabled = true;
    document.getElementById('exerciseMuscle').disabled = true;
    
    // Hide the option toggle when logging workout
    const optionToggleParent = document.querySelector('.exercise-option-toggle')?.parentElement;
    if (optionToggleParent) optionToggleParent.style.display = 'none';
    document.getElementById('existingExerciseSection').style.display = 'none';
    document.getElementById('newExerciseSection').style.display = 'block';
    
    // Show sets section for logging workout
    const setsContainer = document.getElementById('setsContainer');
    if (setsContainer) {
        setsContainer.style.display = 'block';
        const workoutHeading = setsContainer.previousElementSibling;
        if (workoutHeading && workoutHeading.tagName === 'H3') {
            workoutHeading.style.display = 'block';
        }
    }
    document.getElementById('addSetBtn').style.display = 'block';
    const notesParent = document.querySelector('label[for="exerciseNotes"]')?.parentElement;
    if (notesParent) notesParent.style.display = 'block';
    
    // Reset sets for new workout
    resetSetsContainer();
    document.getElementById('exerciseNotes').value = '';

    modal.style.display = 'block';
}

// Edit Exercise Details (name, category, etc.)
function editExerciseDetails(id) {
    const exercise = exercises.find(ex => ex.id === id);
    if (!exercise) return;

    // Close any open detail modals
    document.querySelectorAll('.modal').forEach(m => {
        if (m !== modal) m.remove();
    });

    editingExerciseId = id;
    document.getElementById('modalTitle').textContent = 'Edit Exercise Details - ' + exercise.name;
    
    // Fill form with exercise data (editable)
    document.getElementById('exerciseName').value = exercise.name;
    document.getElementById('exerciseName').readOnly = false;
    
    document.getElementById('exerciseCategory').value = exercise.category;
    document.getElementById('exerciseCategory').disabled = false;
    
    document.getElementById('exerciseMuscle').value = exercise.muscle;
    document.getElementById('exerciseMuscle').disabled = false;
    
    document.getElementById('exerciseImage').value = exercise.image || '';
    document.getElementById('exerciseImage').readOnly = false;
    
    document.getElementById('machineInfo').value = exercise.machineInfo || '';
    document.getElementById('machineInfo').readOnly = false;
    
    // Hide option toggle and sets section
    const optionToggle = document.querySelector('.exercise-option-toggle');
    if (optionToggle && optionToggle.parentElement) {
        optionToggle.parentElement.style.display = 'none';
    }
    document.getElementById('existingExerciseSection').style.display = 'none';
    document.getElementById('newExerciseSection').style.display = 'block';
    
    // Hide sets container and workout heading
    const setsContainer = document.getElementById('setsContainer');
    if (setsContainer) {
        setsContainer.style.display = 'none';
        // Hide the "Today's Workout" heading (previous sibling)
        const workoutHeading = setsContainer.previousElementSibling;
        if (workoutHeading && workoutHeading.tagName === 'H3') {
            workoutHeading.style.display = 'none';
        }
    }
    
    const addSetBtn = document.getElementById('addSetBtn');
    if (addSetBtn) addSetBtn.style.display = 'none';
    
    const notesLabel = document.querySelector('label[for="exerciseNotes"]');
    if (notesLabel && notesLabel.parentElement) {
        notesLabel.parentElement.style.display = 'none';
    }
    
    modal.style.display = 'block';
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

// Show Debug Modal - View All Database Exercises
function showDebugModal() {
    const debugModal = document.createElement('div');
    debugModal.className = 'modal';
    debugModal.style.display = 'block';
    
    let debugHTML = '<h3>All Exercises in Database</h3>';
    debugHTML += `<p>Total exercises: ${exercises.length}</p>`;
    debugHTML += '<div style="max-height: 500px; overflow-y: auto;">';
    
    exercises.forEach((ex, idx) => {
        const allUsers = Object.keys(ex.users);
        const usersWithHistory = allUsers.filter(user => 
            ex.users[user].history && ex.users[user].history.length > 0
        );
        
        debugHTML += `
            <div style="border: 1px solid #ddd; padding: 10px; margin: 10px 0; border-radius: 5px;">
                <strong>${idx + 1}. ${ex.name}</strong><br>
                <small>Category: ${ex.category} | Muscle: ${ex.muscle}</small><br>
                <small>ID: ${ex.id}</small><br>
                <small>All users in object: ${allUsers.join(', ')}</small><br>
                <small style="color: ${usersWithHistory.length > 0 ? 'green' : 'red'};">Users with history: ${usersWithHistory.length > 0 ? usersWithHistory.join(', ') : 'NONE'}</small><br>
        `;
        
        // Show detailed history for each user
        allUsers.forEach(user => {
            const historyCount = ex.users[user]?.history?.length || 0;
            debugHTML += `<small>- ${user}: ${historyCount} workout(s)</small><br>`;
        });
        
        debugHTML += '</div>';
    });
    
    debugHTML += '</div>';
    
    debugModal.innerHTML = `
        <div class="modal-content" style="max-width: 800px;">
            <span class="close" onclick="this.parentElement.parentElement.remove()">&times;</span>
            <h2>🔍 Database Debug Info</h2>
            ${debugHTML}
        </div>
    `;
    
    document.body.appendChild(debugModal);
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
        const userData = ex.users[currentUser];
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
            const history = ex.users[currentUser].history || [];
            
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
        
        // Calculate performance percentage: >0 = progress, 0 = same, <0 = weaker
        let performancePercent = 0;
        if (totalExercises > 0) {
            // Score: +1 for each record, -1 for each weaker, 0 for unchanged
            const performanceScore = recordsCount - weakerCount;
            performancePercent = Math.round((performanceScore / totalExercises) * 100);
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
    
    let overallPerformancePercent = 0;
    if (totalExercisesCompared > 0) {
        const performanceScore = totalRecords - totalWeaker;
        overallPerformancePercent = Math.round((performanceScore / totalExercisesCompared) * 100);
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
        let needNewRoutine = true;
        if (routineMemory[categoryName]) {
            const lastGeneratedDate = new Date(routineMemory[categoryName].generatedAt);
            
            // Check if any exercise from this category was trained after generation
            const anyTrained = categoryExercises.some(ex => {
                const recentWorkouts = ex.users[currentUser].history.filter(h => 
                    new Date(h.date) > lastGeneratedDate
                );
                return recentWorkouts.length > 0;
            });
            
            needNewRoutine = anyTrained;
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
            const userData = ex.users[currentUser];
            const history = userData.history || [];
            const lastSession = history[history.length - 1];
            const lastDate = new Date(lastSession.date);
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
                            <span class="routine-sets">${ex.sets} sets × ${ex.reps} reps @ ${ex.weight}kg</span>
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
                            <div class="history-header">
                                <div class="history-date">${new Date(session.date).toLocaleDateString()} ${new Date(session.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                                <button class="btn-delete-history" onclick="deleteHistory(${exercise.id}, ${history.length - 1 - idx})" title="Delete this workout">🗑️</button>
                            </div>
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
    
    console.log('=== RENDER EXERCISES DEBUG ===');
    console.log('Current user:', currentUser);
    console.log('Total exercises in DB:', exercises.length);
    
    // Log all exercises for current user
    exercises.forEach(ex => {
        const userData = ex.users[currentUser];
        const historyCount = userData?.history?.length || 0;
        if (userData || ex.name.toLowerCase().includes('leg')) {
            console.log(`Exercise: ${ex.name}, User ${currentUser} history: ${historyCount}, All users:`, Object.keys(ex.users));
        }
    });

    let filtered = exercises.filter(exercise => {
        const matchCategory = categoryValue === 'all' || exercise.category === categoryValue;
        const matchMuscle = muscleValue === 'all' || exercise.muscle === muscleValue;
        const matchSearch = exercise.name.toLowerCase().includes(searchValue) ||
                          exercise.muscle.toLowerCase().includes(searchValue) ||
                          exercise.category.toLowerCase().includes(searchValue);
        
        // Only show exercises that the current user has done (has history)
        const userData = exercise.users[currentUser];
        const hasHistory = userData && userData.history && userData.history.length > 0;
        
        return matchCategory && matchMuscle && matchSearch && hasHistory;
    });
    
    console.log('Filtered exercises shown:', filtered.length);
    console.log('=== END DEBUG ===');

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
        exercisesRef.on('value', (snapshot) => {
            const data = snapshot.val();
            if (data) {
                exercises = data;
            }
            renderExercises();
        }, (error) => {
            console.error('Firebase read error:', error);
            alert('Error loading data. Check your internet connection.');
        });
    }
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
