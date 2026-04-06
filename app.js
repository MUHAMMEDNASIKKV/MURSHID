// ============================================
// THARBIYYA - TEACHER SELECTION PORTAL
// Frontend JavaScript (app.js)
// ============================================

// Configuration
// IMPORTANT: Replace with your actual Google Apps Script Web App URL
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycby8vM9lOeZaA6RyHu1q7LSrGKx8Z7CRKl9-_7uSpQFqWKbeA9VG-dbgaEYAAGnYtwnQ/exec";

// Slot limits
const SLOT_RULES = {
    "Thesis": {
        "AP MUSTHAFA HUDAWI": 6,
        "PK JAFAR HUDAWI": 4
    },
    "Course": {
        "AP MUSTHAFA HUDAWI": 15,
        "PK JAFAR HUDAWI": 12
    }
};

const TEACHERS = ["AP MUSTHAFA HUDAWI", "PK JAFAR HUDAWI"];

// Global state
let studentsData = [];      // Array of student objects { enrol, name, mode, murshid }
let currentStudent = null;  // Currently selected student
let selectedTeacher = null;  // Teacher chosen by user
let slotStats = null;        // Cached slot statistics

// DOM Elements
const enrolInput = document.getElementById('enrolNo');
const studentNameField = document.getElementById('studentName');
const modeField = document.getElementById('modeField');
const teacherContainer = document.getElementById('teacherContainer');
const slotInfoDiv = document.getElementById('slotInfo');
const submitBtn = document.getElementById('submitBtn');
const alertPopup = document.getElementById('alertPopup');
const enrolError = document.getElementById('enrolError');

// ============================================
// 🚀 INITIALIZATION
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
    await loadAllStudents();
    await loadSlotStatistics();
    setupEventListeners();
});

function setupEventListeners() {
    // Debounced enrolment lookup
    let debounceTimeout;
    enrolInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimeout);
        const val = e.target.value.trim();
        debounceTimeout = setTimeout(() => {
            if (val.length > 0) {
                lookupStudent(val);
            } else {
                resetStudentUI();
            }
        }, 400);
    });
    
    submitBtn.addEventListener('click', submitSelection);
}

// ============================================
// 📥 DATA LOADING FROM GOOGLE SHEETS
// ============================================

async function loadAllStudents() {
    try {
        const response = await fetch(`${APPS_SCRIPT_URL}?action=getAllStudents&t=${Date.now()}`);
        const data = await response.json();
        
        if (data.error) {
            console.error("Error loading students:", data.error);
            showAlert("Failed to load student data. Please refresh.", true);
            return;
        }
        
        if (Array.isArray(data)) {
            studentsData = data;
        } else if (data.data && Array.isArray(data.data)) {
            studentsData = data.data;
        } else {
            studentsData = [];
        }
        
        console.log(`Loaded ${studentsData.length} students`);
        
    } catch (error) {
        console.error("Error fetching students:", error);
        showAlert("Network error. Please check your connection.", true);
    }
}

async function loadSlotStatistics() {
    try {
        const response = await fetch(`${APPS_SCRIPT_URL}?action=getSlotStatistics&t=${Date.now()}`);
        const data = await response.json();
        
        if (!data.error) {
            slotStats = data;
        }
    } catch (error) {
        console.error("Error loading slot stats:", error);
    }
}

// ============================================
// 🔍 STUDENT LOOKUP
// ============================================

async function lookupStudent(enrol) {
    if (!enrol || enrol.trim() === "") {
        resetStudentUI();
        return false;
    }
    
    // Refresh data to get latest assignments
    await loadAllStudents();
    await loadSlotStatistics();
    
    const found = studentsData.find(s => String(s.enrol).trim() === String(enrol).trim());
    
    if (!found) {
        enrolError.textContent = "❌ Enrolment number not found in registry";
        enrolError.classList.remove("hidden");
        resetStudentUI();
        currentStudent = null;
        selectedTeacher = null;
        renderTeacherCards(null);
        return false;
    }
    
    enrolError.classList.add("hidden");
    currentStudent = { ...found };
    studentNameField.value = currentStudent.name;
    modeField.value = currentStudent.mode;
    
    // Check if student already has a teacher assigned
    if (currentStudent.murshid && currentStudent.murshid.trim() !== "") {
        selectedTeacher = currentStudent.murshid;
        renderTeacherCards(currentStudent.mode);
        showAlert(`ℹ️ You already have a teacher: ${currentStudent.murshid}. Selection cannot be changed.`, false);
        submitBtn.disabled = true;
        submitBtn.style.opacity = "0.6";
        submitBtn.style.cursor = "not-allowed";
    } else {
        selectedTeacher = null;
        renderTeacherCards(currentStudent.mode);
        submitBtn.disabled = false;
        submitBtn.style.opacity = "1";
        submitBtn.style.cursor = "pointer";
    }
    
    return true;
}

function resetStudentUI() {
    studentNameField.value = '';
    modeField.value = '';
    currentStudent = null;
    selectedTeacher = null;
    renderTeacherCards(null);
    submitBtn.disabled = false;
    submitBtn.style.opacity = "1";
    submitBtn.style.cursor = "pointer";
}

// ============================================
// 🎨 RENDER TEACHER CARDS
// ============================================

function getCurrentSlotUsage(mode) {
    const usage = {
        "AP MUSTHAFA HUDAWI": 0,
        "PK JAFAR HUDAWI": 0
    };
    
    studentsData.forEach(student => {
        if (student.mode === mode && student.murshid && student.murshid.trim() !== "") {
            if (usage[student.murshid] !== undefined) {
                usage[student.murshid]++;
            }
        }
    });
    
    return usage;
}

function isSlotAvailable(teacher, mode) {
    const usage = getCurrentSlotUsage(mode);
    const limit = SLOT_RULES[mode]?.[teacher] || 0;
    const current = usage[teacher] || 0;
    return current < limit;
}

function getRemainingSlots(teacher, mode) {
    const usage = getCurrentSlotUsage(mode);
    const limit = SLOT_RULES[mode]?.[teacher] || 0;
    const current = usage[teacher] || 0;
    return Math.max(0, limit - current);
}

function renderTeacherCards(mode) {
    if (!mode) {
        teacherContainer.innerHTML = `
            <div class="col-span-2 text-center text-gray-400 py-8">
                <i class="fas fa-search text-3xl mb-2"></i>
                <p>Enter your enrolment number to see teacher options</p>
            </div>
        `;
        slotInfoDiv.innerHTML = '';
        return;
    }
    
    const usage = getCurrentSlotUsage(mode);
    let cardsHtml = '';
    
    TEACHERS.forEach(teacher => {
        const limit = SLOT_RULES[mode]?.[teacher] || 0;
        const current = usage[teacher] || 0;
        const available = current < limit;
        const remaining = limit - current;
        const isSelected = (selectedTeacher === teacher);
        const isAlreadyAssigned = currentStudent?.murshid && currentStudent.murshid.trim() !== "";
        
        let disabledClass = '';
        let clickHandler = '';
        
        if (!available || isAlreadyAssigned) {
            disabledClass = 'opacity-50 cursor-not-allowed border-gray-200 bg-gray-50';
            clickHandler = '';
        } else {
            disabledClass = 'cursor-pointer hover:shadow-md transition-all';
            clickHandler = `onclick="selectTeacher('${teacher}')"`;
        }
        
        const selectedClass = isSelected ? 'selected border-emerald-700 bg-emerald-50' : '';
        
        cardsHtml += `
            <div class="teacher-card border-2 rounded-xl p-4 ${disabledClass} ${selectedClass}" ${clickHandler} data-teacher="${teacher}">
                <div class="flex justify-between items-start">
                    <div>
                        <h3 class="font-bold text-gray-800 text-lg">${teacher}</h3>
                        <p class="text-xs text-gray-500 mt-1">Murshid</p>
                    </div>
                    <div class="text-xs font-semibold px-3 py-1 rounded-full ${available ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}">
                        ${available ? `✓ ${remaining} slot${remaining !== 1 ? 's' : ''} left` : '✗ Full'}
                    </div>
                </div>
                <div class="mt-2 text-xs text-gray-500">
                    ${available ? `Available: ${remaining} / ${limit}` : `No seats left for ${mode} mode`}
                </div>
            </div>
        `;
    });
    
    teacherContainer.innerHTML = cardsHtml;
    
    // Update slot info summary
    const thesisAPRemaining = getRemainingSlots("AP MUSTHAFA HUDAWI", "Thesis");
    const thesisPKRemaining = getRemainingSlots("PK JAFAR HUDAWI", "Thesis");
    const courseAPRemaining = getRemainingSlots("AP MUSTHAFA HUDAWI", "Course");
    const coursePKRemaining = getRemainingSlots("PK JAFAR HUDAWI", "Course");
    
    slotInfoDiv.innerHTML = `
        <div class="flex flex-wrap gap-3 justify-between">
            <span class="bg-gray-100 px-3 py-1.5 rounded-full text-xs font-medium">
                <i class="fas fa-university text-emerald-600 mr-1"></i> Thesis: 
                AP (${thesisAPRemaining}) | PK (${thesisPKRemaining})
            </span>
            <span class="bg-gray-100 px-3 py-1.5 rounded-full text-xs font-medium">
                <i class="fas fa-book-open text-emerald-600 mr-1"></i> Course: 
                AP (${courseAPRemaining}) | PK (${coursePKRemaining})
            </span>
        </div>
    `;
}

// Global function for teacher selection (called from onclick)
window.selectTeacher = function(teacher) {
    if (!currentStudent) {
        showAlert("Please enter a valid enrolment number first");
        return;
    }
    
    if (currentStudent.murshid && currentStudent.murshid.trim() !== "") {
        showAlert(`You have already selected ${currentStudent.murshid}. Selection cannot be changed.`);
        return;
    }
    
    if (!isSlotAvailable(teacher, currentStudent.mode)) {
        showAlert(`No available slots for ${teacher} in ${currentStudent.mode} mode. Slots are full.`);
        renderTeacherCards(currentStudent.mode);
        return;
    }
    
    selectedTeacher = teacher;
    renderTeacherCards(currentStudent.mode);
    showAlert(`Selected: ${teacher}`, false);
};

// ============================================
// 📤 SUBMIT SELECTION
// ============================================

async function submitSelection() {
    if (!currentStudent) {
        showAlert("❌ Please enter a valid enrolment number first.");
        return;
    }
    
    if (currentStudent.murshid && currentStudent.murshid.trim() !== "") {
        showAlert(`⚠️ You already selected ${currentStudent.murshid}. Selection cannot be changed.`);
        return;
    }
    
    if (!selectedTeacher) {
        showAlert("⚠️ Please select a teacher (Murshid) before submitting.");
        return;
    }
    
    // Double-check slot availability
    if (!isSlotAvailable(selectedTeacher, currentStudent.mode)) {
        showAlert(`❌ No available slots for ${selectedTeacher} in ${currentStudent.mode} mode. Slots are full.`);
        renderTeacherCards(currentStudent.mode);
        return;
    }
    
    // Show loading state
    const originalBtnHtml = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';
    
    try {
        const response = await fetch(APPS_SCRIPT_URL, {
            method: "POST",
            mode: "cors",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded"
            },
            body: new URLSearchParams({
                action: "updateMurshid",
                enrolNo: currentStudent.enrol,
                murshid: selectedTeacher,
                mode: currentStudent.mode
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            // Update local data
            currentStudent.murshid = selectedTeacher;
            const index = studentsData.findIndex(s => s.enrol === currentStudent.enrol);
            if (index !== -1) {
                studentsData[index].murshid = selectedTeacher;
            }
            
            showAlert(`✅ Success! You have selected ${selectedTeacher} as your Murshid.`, false);
            
            // Refresh and disable further changes
            await loadSlotStatistics();
            renderTeacherCards(currentStudent.mode);
            submitBtn.disabled = true;
            submitBtn.style.opacity = "0.6";
            submitBtn.style.cursor = "not-allowed";
            
        } else {
            showAlert(`❌ Submission failed: ${result.error || "Unknown error"}`);
            // Refresh data to show updated slot status
            await loadAllStudents();
            renderTeacherCards(currentStudent.mode);
        }
        
    } catch (error) {
        console.error("Submit error:", error);
        showAlert("Network error: Could not update. Please try again later.");
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnHtml;
        if (currentStudent?.murshid) {
            submitBtn.disabled = true;
            submitBtn.style.opacity = "0.6";
        }
    }
}

// ============================================
// 🔔 UI HELPERS
// ============================================

function showAlert(message, isError = true) {
    alertPopup.textContent = message;
    alertPopup.style.background = isError ? "#dc2626" : "#059669";
    alertPopup.classList.add('show');
    setTimeout(() => {
        alertPopup.classList.remove('show');
    }, 3000);
}

// ============================================
// 🔒 SECURITY (Optional)
// ============================================

// Disable right-click
document.addEventListener("contextmenu", function(e) {
    e.preventDefault();
});

// Disable inspect shortcuts
document.addEventListener("keydown", function(e) {
    if (e.key === "F12" || 
        (e.ctrlKey && e.shiftKey && (e.key === "I" || e.key === "J" || e.key === "C")) ||
        (e.ctrlKey && (e.key === "u" || e.key === "U"))) {
        e.preventDefault();
    }
});

console.log('%c🌙 Tharbiyya - Teacher Selection Portal Loaded 🌙', 'color: #059669; font-size: 16px; font-weight: bold;');
