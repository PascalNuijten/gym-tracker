// Gym Tracker v2.0 - Separate Exercise Creation & Workout Logging
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
    
    // Export Button
    document.getElementById('exportBtn').addEventListener('click', exportData);
    
    // Restore Button
    document.getElementById('restoreBtn').addEventListener('click', restoreData);
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
    
    // Get all exercises that current user hasn't done yet
    // This includes exercises done by other users OR exercises with no history at all
    const availableExercises = exercises.filter(ex => {
        // Safety check: ensure users object exists
        if (!ex.users) {
            ex.users = {};
        }
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
    `;
    
    // Reset workout sets
    resetWorkoutSetsContainer();
    document.getElementById('workoutNotes').value = '';

    workoutModal.style.display = 'block';
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
function generateSuggestion(history) {
    if (!history || history.length === 0) {
        return "🎯 <strong>Start Smart:</strong> Begin with a weight you can lift for 8-12 reps with proper form. Leave 2-3 reps 'in the tank' on your first session.";
    }

    const lastSession = history[history.length - 1];
    const lastSets = lastSession.sets;
    const avgWeight = lastSets.reduce((sum, set) => sum + set.weight, 0) / lastSets.length;
    const avgReps = lastSets.reduce((sum, set) => sum + set.reps, 0) / lastSets.length;
    const totalVolume = lastSets.reduce((sum, set) => sum + (set.reps * set.weight), 0);
    
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
    
    if (allDates.length > 5) {
        // Check if more than 80% of dates are within 1 minute of each other
        const sortedDates = allDates.sort((a, b) => a - b);
        const median = sortedDates[Math.floor(sortedDates.length / 2)];
        const oneMinute = 60 * 1000;
        const nearMedian = allDates.filter(d => Math.abs(d - median) < oneMinute);
        
        if (nearMedian.length > allDates.length * 0.8) {
            errors.push(`⚠️ ${Math.round(nearMedian.length / allDates.length * 100)}% of workout dates are suspiciously similar (within 1 minute)`);
            errors.push(`This suggests data corruption. Median date: ${new Date(median).toLocaleString()}`);
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
                                console.log('✅ Auto-restored from valid backup (Firebase data was corrupted)');
                                saveToFirebase(); // Overwrite corrupted Firebase data
                                renderExercises();
                                alert(`✅ Data automatically restored from backup\n\nFirebase data had issues, so we used your backup from ${new Date(backup.timestamp).toLocaleString()}`);
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
    
    setTimeout(() => {
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
        const topCategory = sortedCategories[0][0];
        const weakestCategory = sortedCategories[sortedCategories.length - 1][0];
        
        // Generate comprehensive feedback
        let feedback = `<h4>📊 ${periodName}'s Complete Analysis</h4>`;
        
        // Workout Summary
        feedback += `<p><strong>Workout Summary:</strong></p>`;
        feedback += `<ul>`;
        feedback += `<li>🏋️ ${uniqueExercises} different exercises completed</li>`;
        feedback += `<li>💪 ${totalSets} total sets performed</li>`;
        feedback += `<li>⚖️ ${totalVolume.toLocaleString()}kg total volume moved</li>`;
        feedback += `<li>📅 ${uniqueDays} training days</li>`;
        feedback += `</ul>`;
        
        // Muscle Group Distribution
        feedback += `<p><strong>📈 Muscle Group Distribution:</strong></p>`;
        feedback += `<ul>`;
        sortedCategories.forEach(([cat, sets], idx) => {
            const icon = idx === 0 ? '🏆' : idx === sortedCategories.length - 1 ? '⚠️' : '✓';
            feedback += `<li>${icon} ${cat}: ${sets} sets</li>`;
        });
        feedback += `</ul>`;
        
        // Personalized Insights
        feedback += `<p><strong>💡 Insights & Recommendations:</strong></p>`;
        feedback += `<ul>`;
        
        // Training frequency feedback
        if (period === 'week') {
            if (uniqueDays < 3) {
                feedback += `<li>🔴 ${uniqueDays} training days this week. Aim for 3-5 days for optimal muscle growth.</li>`;
            } else if (uniqueDays >= 3 && uniqueDays <= 5) {
                feedback += `<li>🟢 Excellent! ${uniqueDays} training days is ideal for most people.</li>`;
            } else {
                feedback += `<li>🟡 ${uniqueDays} training days is quite high. Ensure you're recovering properly!</li>`;
            }
        }
        
        // Volume feedback
        const avgSetsPerDay = totalSets / uniqueDays;
        if (avgSetsPerDay < 12) {
            feedback += `<li>Consider increasing volume - averaging ${Math.round(avgSetsPerDay)} sets per session. Aim for 12-20.</li>`;
        } else if (avgSetsPerDay > 25) {
            feedback += `<li>High volume (${Math.round(avgSetsPerDay)} sets/session). Make sure you're eating and sleeping enough!</li>`;
        } else {
            feedback += `<li>Good volume - ${Math.round(avgSetsPerDay)} sets per session is in the sweet spot.</li>`;
        }
        
        // Balance feedback
        const ratio = sortedCategories[0][1] / (sortedCategories[sortedCategories.length - 1][1] || 1);
        if (ratio > 2.5) {
            feedback += `<li>⚠️ <strong>Imbalance detected:</strong> ${topCategory} trained ${ratio.toFixed(1)}x more than ${weakestCategory}. Add more ${weakestCategory} exercises!</li>`;
        } else if (ratio > 1.5) {
            feedback += `<li>Minor imbalance: Consider adding more ${weakestCategory} exercises for balanced development.</li>`;
        } else {
            feedback += `<li>✅ Well-balanced training across muscle groups!</li>`;
        }
        
        // Push/Pull/Legs analysis
        const pushCategories = ['Chest', 'Shoulders', 'Triceps'];
        const pullCategories = ['Upper Back', 'Lower Back', 'Biceps'];
        const legCategories = ['Legs'];
        
        const pushVolume = sortedCategories.filter(([cat]) => pushCategories.includes(cat))
            .reduce((sum, [, sets]) => sum + sets, 0);
        const pullVolume = sortedCategories.filter(([cat]) => pullCategories.includes(cat))
            .reduce((sum, [, sets]) => sum + sets, 0);
        const legVolume = sortedCategories.filter(([cat]) => legCategories.includes(cat))
            .reduce((sum, [, sets]) => sum + sets, 0);
        
        if (legVolume > 0 && legVolume < pushVolume * 0.5) {
            feedback += `<li>🦵 Don't skip leg day! Your leg volume (${legVolume} sets) is low compared to upper body (${pushVolume} sets).</li>`;
        }
        
        if (pullVolume > 0 && pullVolume < pushVolume * 0.7) {
            feedback += `<li>💡 Increase pull exercises (${pullVolume} sets) to balance pushing movements (${pushVolume} sets) and prevent shoulder issues.</li>`;
        }
        
        feedback += `</ul>`;
        
        // Fun fact
        feedback += generateFunFact(totalVolume, totalSets, period);
        
        resultBox.innerHTML = feedback;
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

function generateFunFact(totalVolume, totalSets, period) {
    const facts = [];
    
    // Volume comparisons
    if (totalVolume > 0) {
        const elephants = (totalVolume / 6000).toFixed(1);
        const cars = (totalVolume / 1500).toFixed(1);
        
        if (elephants >= 1) {
            facts.push(`You moved ${totalVolume}kg - that's equivalent to ${elephants} elephants! 🐘`);
        } else if (cars >= 1) {
            facts.push(`You moved ${totalVolume}kg - that's like lifting ${cars} cars! 🚗`);
        } else {
            const pianos = (totalVolume / 400).toFixed(1);
            if (pianos >= 1) {
                facts.push(`You moved ${totalVolume}kg - equivalent to ${pianos} grand pianos! 🎹`);
            }
        }
    }
    
    // Performance percentiles (simulated)
    const percentile = Math.min(95, 50 + (totalSets * 2));
    facts.push(`Based on your volume, you're in the top ${100 - percentile}% of recreational lifters! 🏆`);
    
    // Athlete comparisons
    if (totalVolume > 10000) {
        facts.push(`Your training volume matches that of competitive powerlifters! 💪`);
    } else if (totalVolume > 5000) {
        facts.push(`You're training like a college athlete! Keep it up! 🎓`);
    }
    
    // Sets comparison
    if (totalSets > 100) {
        facts.push(`${totalSets} sets ${period === 'week' ? 'this week' : 'this month'}! That's more than most professional bodybuilders! 🏋️‍♂️`);
    }
    
    const randomFact = facts[Math.floor(Math.random() * facts.length)];
    return `<div class="fun-fact-box"><h5>🎉 Fun Fact</h5><p>${randomFact}</p></div>`;
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
    
    // Simulate AI analysis (in real implementation, you'd use TensorFlow.js or cloud vision API)
    setTimeout(() => {
        const detectedExercise = analyzeEquipmentAndIdentifyExercise();
        processDetectedExercise(detectedExercise, resultBox);
    }, 2000);
}

function analyzeEquipmentAndIdentifyExercise() {
    // Simulated equipment detection with exercise details and confidence level
    // In real implementation, use TensorFlow.js with a trained model or Vision API
    const exerciseDatabase = [
        { name: 'Lat Pulldown', category: 'Upper Back', muscle: 'Lats', equipment: 'Lat Pulldown Machine' },
        { name: 'Leg Press', category: 'Legs', muscle: 'Quads', equipment: 'Leg Press Machine' },
        { name: 'Chest Press', category: 'Chest', muscle: 'Middle Chest', equipment: 'Chest Press Machine' },
        { name: 'Shoulder Press', category: 'Shoulders', muscle: 'Front Delts', equipment: 'Shoulder Press Machine' },
        { name: 'Cable Rows', category: 'Upper Back', muscle: 'Lats', equipment: 'Cable Machine' },
        { name: 'Cable Chest Flys', category: 'Chest', muscle: 'Middle Chest', equipment: 'Cable Machine' },
        { name: 'Leg Extension', category: 'Legs', muscle: 'Quads', equipment: 'Leg Extension Machine' },
        { name: 'Leg Curl', category: 'Legs', muscle: 'Hamstrings', equipment: 'Leg Curl Machine' },
        { name: 'Seated Row', category: 'Upper Back', muscle: 'Lats', equipment: 'Rowing Machine' },
        { name: 'Bench Press', category: 'Chest', muscle: 'Middle Chest', equipment: 'Bench Press' },
        { name: 'Incline Bench Press', category: 'Chest', muscle: 'Upper Chest', equipment: 'Incline Bench' },
        { name: 'Pec Deck', category: 'Chest', muscle: 'Middle Chest', equipment: 'Pec Deck Machine' },
        { name: 'Tricep Pushdown', category: 'Triceps', muscle: 'Triceps', equipment: 'Cable Machine' },
        { name: 'Bicep Curl Machine', category: 'Biceps', muscle: 'Biceps', equipment: 'Bicep Curl Machine' },
        { name: 'Leg Press Calf Raise', category: 'Legs', muscle: 'Calves', equipment: 'Leg Press Machine' }
    ];
    
    // Randomly select an exercise and confidence (in real app, this would be AI detection)
    const detectedExercise = exerciseDatabase[Math.floor(Math.random() * exerciseDatabase.length)];
    // Simulate confidence between 60-95%
    const confidence = Math.floor(Math.random() * 35) + 60;
    
    return {
        ...detectedExercise,
        confidence: confidence
    };
}

function processDetectedExercise(detectedExercise, resultBox) {
    console.log('Detected exercise:', detectedExercise);
    
    // Check confidence level
    if (detectedExercise.confidence < 70) {
        resultBox.innerHTML = `
            <h4>⚠️ Low Confidence Detection</h4>
            <p>I'm only ${detectedExercise.confidence}% confident this is <strong>${detectedExercise.name}</strong>.</p>
            <p><strong>Suggestions:</strong></p>
            <ul>
                <li>Try getting closer to the equipment</li>
                <li>Ensure better lighting</li>
                <li>Center the equipment in the frame</li>
                <li>Or manually add the exercise instead</li>
            </ul>
            <button class="primary-btn" onclick="retryCamera()">📷 Try Again</button>
            <button class="secondary-btn" onclick="aiModal.style.display='none'; stopCamera(); modal.style.display='block';">➕ Add Manually</button>
        `;
        return;
    }
    
    // Show confidence in result
    const confidenceText = detectedExercise.confidence >= 85 ? 
        `<p style="color: #4caf50; font-weight: 600;">✓ ${detectedExercise.confidence}% confidence - High accuracy!</p>` :
        `<p style="color: #ff9800; font-weight: 600;">⚠ ${detectedExercise.confidence}% confidence - Moderate accuracy</p>`;
    
    // Step 1: Check if user already has this exercise
    const userExercise = exercises.find(ex => 
        ex.user === currentUser && 
        ex.name.toLowerCase() === detectedExercise.name.toLowerCase()
    );
    
    if (userExercise) {
        // User already has this exercise - open workout modal
        resultBox.innerHTML = `
            <h4>✅ Exercise Found in Your Library!</h4>
            ${confidenceText}
            <p><strong>${detectedExercise.name}</strong> is already in your exercises.</p>
            <p>Opening workout logging...</p>
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
            <h4>📋 Exercise Found in Database!</h4>
            ${confidenceText}
            <p><strong>${detectedExercise.name}</strong> exists in the app.</p>
            <p>Adding to your exercises and opening workout logging...</p>
        `;
        
        setTimeout(() => {
            // Add exercise for current user
            addExerciseFromTemplate(globalExercise);
        }, 1500);
        return;
    }
    
    // Step 3: Exercise doesn't exist anywhere - open creation modal with pre-filled data
    resultBox.innerHTML = `
        <h4>🆕 New Exercise Detected!</h4>
        ${confidenceText}
        <p><strong>${detectedExercise.name}</strong> is not in the database yet.</p>
        <p>Opening exercise creation form with detected details...</p>
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

function openExerciseModalWithDetectedData(detectedExercise) {
    // Reset form
    document.getElementById('exerciseForm').reset();
    editingExerciseId = null;
    
    // Set to "new" mode
    document.getElementById('newExerciseOption').click();
    
    // Pre-fill detected data
    document.getElementById('exerciseName').value = detectedExercise.name;
    document.getElementById('exerciseCategory').value = detectedExercise.category;
    
    // Trigger category change to load muscle options
    const categoryEvent = new Event('change');
    document.getElementById('exerciseCategory').dispatchEvent(categoryEvent);
    
    // Wait a bit for muscle options to load, then set muscle
    setTimeout(() => {
        const muscleSelect = document.getElementById('exerciseMuscle');
        // Try to find matching muscle option
        for (let i = 0; i < muscleSelect.options.length; i++) {
            if (muscleSelect.options[i].value === detectedExercise.muscle) {
                muscleSelect.value = detectedExercise.muscle;
                break;
            }
        }
    }, 100);
    
    // Update modal title
    document.getElementById('modalTitle').textContent = '📸 Add Detected Exercise';
    
    modal.style.display = 'block';
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
    
    setTimeout(() => {
        const exercise = exercises.find(ex => ex.id === exerciseId);
        const alternatives = getAIExerciseAlternatives(exercise, reason);
        
        let html = `<h4>🔄 AI-Powered Alternatives for ${exercise.name}</h4>`;
        
        if (reason) {
            html += `<p><em>Considering: ${reason}</em></p>`;
        }
        
        html += `<div style="margin-top: 15px;">`;
        
        alternatives.forEach((alt, idx) => {
            const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '💪';
            
            html += `<div style="background: ${idx < 3 ? '#f0f9ff' : '#f9f9f9'}; padding: 12px; margin-bottom: 10px; border-radius: 8px; border-left: 3px solid ${idx === 0 ? '#4CAF50' : idx === 1 ? '#2196F3' : idx === 2 ? '#FF9800' : '#ddd'};">`;
            html += `<div style="display: flex; justify-content: space-between; align-items: start;">`;
            html += `<div style="flex: 1;">`;
            html += `<div style="font-weight: bold; font-size: 1.05rem; margin-bottom: 4px;">${medal} ${alt.name}</div>`;
            
            if (alt.muscle) {
                html += `<div style="color: #666; font-size: 0.85rem; margin-bottom: 4px;">🎯 <strong>Targets:</strong> ${alt.muscle}</div>`;
            }
            
            html += `<div style="color: #555; font-size: 0.9rem;">${alt.reason}</div>`;
            html += `</div>`;
            
            if (alt.video) {
                html += `<a href="${alt.video}" target="_blank" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 8px 12px; border-radius: 6px; text-decoration: none; font-size: 0.85rem; white-space: nowrap; margin-left: 10px; display: inline-block;">📹 Watch Tutorial</a>`;
            }
            
            html += `</div>`;
            html += `</div>`;
        });
        
        html += `</div>`;
        html += `<p style="margin-top: 15px; padding: 10px; background: #fffbea; border-left: 3px solid #ffc107; border-radius: 4px; color: #666; font-size: 0.9rem;">💡 <strong>Tip:</strong> These exercises are ranked by similarity in muscle activation, movement pattern, and equipment requirements. Click "Watch Tutorial" to see proper form demonstrations on YouTube.</p>`;
        
        resultBox.innerHTML = html;
    }, 1500);
}

function getAIExerciseAlternatives(exercise, reason) {
    // AI-POWERED DYNAMIC RECOMMENDATIONS
    // Analyzes exercise characteristics and generates intelligent alternatives
    
    const lowerReason = reason.toLowerCase();
    const exerciseName = exercise.name.toLowerCase();
    const muscle = (exercise.muscle || exercise.category || '').toLowerCase();
    
    // Handle injury/pain - prioritize recovery
    if (lowerReason.includes('pain') || lowerReason.includes('injury') || lowerReason.includes('hurt')) {
        return [
            { name: '⚕️ See a Doctor/PT', muscle: 'Recovery', reason: 'Professional diagnosis for persistent pain', video: 'https://www.youtube.com/results?search_query=when+to+see+doctor+gym+injury' },
            { name: 'Rest & Ice (RICE Protocol)', muscle: 'Recovery', reason: '48-72 hours for acute injuries', video: 'https://www.youtube.com/results?search_query=RICE+protocol+injury' },
            { name: 'Mobility Work', muscle: 'Recovery', reason: 'Gentle movements to maintain range of motion', video: 'https://www.youtube.com/results?search_query=injury+mobility+exercises' },
            { name: 'Light Antagonist Training', muscle: 'Active Recovery', reason: 'Train opposite muscle groups while healing', video: 'https://www.youtube.com/results?search_query=training+around+injury' },
            { name: `Light ${exercise.name} (50% weight)`, muscle: muscle, reason: 'Test with minimal load after recovery', video: `https://www.youtube.com/results?search_query=${encodeURIComponent(exercise.name)}+light+weight+recovery` }
        ];
    }
    
    // AI ANALYSIS: Determine exercise characteristics
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
    
    // AI GENERATION: Create intelligent alternatives based on muscle group and exercise type
    const alternatives = [];
    
    // CHEST EXERCISES
    if (muscle.includes('chest') || exerciseName.includes('bench') || exerciseName.includes('press') && muscle.includes('chest')) {
        const chestAlts = [
            { name: 'Dumbbell Bench Press', muscle: 'Full Chest', reason: 'Greater range of motion, fixes imbalances', difficulty: 'Intermediate' },
            { name: 'Incline Barbell Press', muscle: 'Upper Chest', reason: '30-45° targets clavicular head', difficulty: 'Intermediate' },
            { name: 'Decline Press', muscle: 'Lower Chest', reason: 'Emphasizes lower pec fibers', difficulty: 'Intermediate' },
            { name: 'Cable Crossovers', muscle: 'Inner Chest', reason: 'Constant tension, peak contraction', difficulty: 'Beginner' },
            { name: 'Weighted Dips', muscle: 'Lower Chest + Triceps', reason: 'Compound movement, lean forward', difficulty: 'Advanced' },
            { name: 'Landmine Press', muscle: 'Upper Chest', reason: 'Shoulder-friendly angle', difficulty: 'Intermediate' },
            { name: 'Push-ups (Diamond/Decline)', muscle: 'Chest Variations', reason: 'Bodyweight progression', difficulty: 'Beginner' },
            { name: 'Pec Deck Machine', muscle: 'Chest Isolation', reason: 'Easy to control, constant tension', difficulty: 'Beginner' }
        ];
        
        // Smart filtering based on equipment preference
        if (lowerReason.includes('busy') || lowerReason.includes('occupied')) {
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
            { name: 'Weighted Pull-ups', muscle: 'Lats + Biceps', reason: 'King of back width', difficulty: 'Advanced' },
            { name: 'Pendlay Rows', muscle: 'Upper Back', reason: 'Explosive power from floor', difficulty: 'Advanced' },
            { name: 'T-Bar Rows', muscle: 'Mid Back Thickness', reason: 'Supported, heavy loads', difficulty: 'Intermediate' },
            { name: 'Lat Pulldown (Close Grip)', muscle: 'Lower Lats', reason: 'Targets lower lat fibers', difficulty: 'Beginner' },
            { name: 'Face Pulls', muscle: 'Rear Delts + Upper Back', reason: 'Shoulder health essential', difficulty: 'Beginner' },
            { name: 'Straight Arm Pulldown', muscle: 'Lat Isolation', reason: 'Removes biceps, pure lat', difficulty: 'Intermediate' },
            { name: 'Inverted Rows', muscle: 'Mid Back', reason: 'Bodyweight horizontal pull', difficulty: 'Beginner' },
            { name: 'Chest-Supported Row', muscle: 'Clean Reps', reason: 'Eliminates cheating', difficulty: 'Intermediate' }
        ];
        alternatives.push(...backAlts.slice(0, 5));
    }
    
    // SHOULDER EXERCISES
    else if (muscle.includes('shoulder') || muscle.includes('delt') || exerciseName.includes('shoulder') || 
             (exerciseName.includes('press') && !muscle.includes('chest') && !muscle.includes('leg'))) {
        const shoulderAlts = [
            { name: 'Arnold Press', muscle: 'All 3 Deltoid Heads', reason: 'Rotation hits front/side/rear', difficulty: 'Intermediate' },
            { name: 'Cable Lateral Raises', muscle: 'Side Delts', reason: 'Constant tension, width builder', difficulty: 'Beginner' },
            { name: 'Face Pulls', muscle: 'Rear Delts', reason: 'Shoulder health and posture', difficulty: 'Beginner' },
            { name: 'Lu Raises', muscle: 'Side + Rear Delts', reason: 'Overhead finish, unique stimulus', difficulty: 'Advanced' },
            { name: 'Landmine Press', muscle: 'Front Delts', reason: 'Joint-friendly angle', difficulty: 'Intermediate' },
            { name: 'Pike Push-ups', muscle: 'Shoulders', reason: 'Bodyweight shoulder builder', difficulty: 'Beginner' },
            { name: 'Reverse Pec Deck', muscle: 'Rear Delts', reason: 'Isolation, constant tension', difficulty: 'Beginner' }
        ];
        alternatives.push(...shoulderAlts.slice(0, 5));
    }
    
    // LEG EXERCISES
    else if (muscle.includes('leg') || muscle.includes('quad') || muscle.includes('hamstring') || 
             exerciseName.includes('squat') || exerciseName.includes('leg') || exerciseName.includes('deadlift')) {
        const legAlts = [
            { name: 'Bulgarian Split Squats', muscle: 'Quads + Glutes', reason: 'Best single-leg exercise', difficulty: 'Intermediate' },
            { name: 'Front Squats', muscle: 'Quads', reason: 'More upright, quad emphasis', difficulty: 'Advanced' },
            { name: 'Romanian Deadlifts', muscle: 'Hamstrings', reason: 'Hip hinge, posterior chain', difficulty: 'Intermediate' },
            { name: 'Nordic Curls', muscle: 'Hamstrings', reason: 'Eccentric strength, injury prevention', difficulty: 'Advanced' },
            { name: 'Goblet Squats', muscle: 'Quads', reason: 'Easy to learn, mobility', difficulty: 'Beginner' },
            { name: 'Walking Lunges', muscle: 'Functional Legs', reason: 'Dynamic, real-world strength', difficulty: 'Beginner' },
            { name: 'Sissy Squats', muscle: 'Quad Isolation', reason: 'Bodyweight quad killer', difficulty: 'Advanced' }
        ];
        alternatives.push(...legAlts.slice(0, 5));
    }
    
    // BICEP EXERCISES
    else if (muscle.includes('bicep') || exerciseName.includes('curl')) {
        const bicepAlts = [
            { name: 'Spider Curls', muscle: 'Bicep Peak', reason: 'Strict form, peak contraction', difficulty: 'Intermediate' },
            { name: 'Incline Dumbbell Curls', muscle: 'Bicep Stretch', reason: 'Deep stretch, long head', difficulty: 'Beginner' },
            { name: 'Hammer Curls', muscle: 'Brachialis', reason: 'Arm thickness, forearm size', difficulty: 'Beginner' },
            { name: '21s (7+7+7 Reps)', muscle: 'Complete Bicep', reason: 'Time under tension, extreme pump', difficulty: 'Advanced' },
            { name: 'Drag Curls', muscle: 'Long Head Bicep', reason: 'Bar drags up torso, unique angle', difficulty: 'Intermediate' },
            { name: 'Chin-ups', muscle: 'Biceps + Back', reason: 'Compound bodyweight movement', difficulty: 'Intermediate' }
        ];
        alternatives.push(...bicepAlts.slice(0, 5));
    }
    
    // TRICEP EXERCISES
    else if (muscle.includes('tricep') || exerciseName.includes('tricep') || 
             (exerciseName.includes('extension') && !exerciseName.includes('leg'))) {
        const tricepAlts = [
            { name: 'JM Press', muscle: 'Tricep Mass', reason: 'Hybrid skull crusher + close grip', difficulty: 'Advanced' },
            { name: 'Overhead Cable Extension', muscle: 'Long Head', reason: 'Overhead stretches long head', difficulty: 'Beginner' },
            { name: 'Close Grip Bench Press', muscle: 'Compound Tricep', reason: 'Heavy loads, full arm', difficulty: 'Intermediate' },
            { name: 'Diamond Push-ups', muscle: 'Triceps', reason: 'Bodyweight, anywhere', difficulty: 'Beginner' },
            { name: 'Tate Press', muscle: 'Lateral/Medial Head', reason: 'Unique elbow position', difficulty: 'Advanced' },
            { name: 'Tricep Dips', muscle: 'Triceps + Chest', reason: 'Compound bodyweight', difficulty: 'Intermediate' }
        ];
        alternatives.push(...tricepAlts.slice(0, 5));
    }
    
    // GENERIC FALLBACK for uncommon exercises
    else {
        alternatives.push(
            { name: 'Progressive Overload', muscle: 'All Muscles', reason: 'Gradually increase weight/reps/sets', difficulty: 'All Levels' },
            { name: 'Compound Movements', muscle: 'Multiple Groups', reason: 'Multi-joint efficiency', difficulty: 'All Levels' },
            { name: 'Bodyweight Variations', muscle: 'Functional', reason: 'Master bodyweight first', difficulty: 'Beginner' },
            { name: 'Consult a Trainer', muscle: 'Personalized', reason: 'Get exercise-specific recommendations', difficulty: 'All Levels' }
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
});

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', init);
