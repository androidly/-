// 主题切换功能 - 独立模块
const themeToggleButton = document.getElementById('theme-toggle');

function applyThemePreference(theme) {
    console.log('Applying theme preference:', theme);
    if (theme === 'dark') {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }
}

function initializeTheme() {
    console.log('Initializing theme...');
    const savedTheme = localStorage.getItem('theme');
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    if (savedTheme) {
        applyThemePreference(savedTheme);
    } else {
        applyThemePreference(systemPrefersDark ? 'dark' : 'light');
    }
    console.log('Initial HTML classes:', document.documentElement.classList);
}

if (themeToggleButton) {
    themeToggleButton.addEventListener('click', () => {
        console.log('Theme toggle button clicked.');
        const htmlElement = document.documentElement;
        const isCurrentlyDark = htmlElement.classList.contains('dark');
        const newTheme = isCurrentlyDark ? 'light' : 'dark';
        
        localStorage.setItem('theme', newTheme);
        applyThemePreference(newTheme);
        console.log('Theme changed to:', newTheme);
        console.log('HTML classes after toggle:', htmlElement.classList);
    });
} else {
    console.error('Theme toggle button not found!');
}

// Initialize theme on page load
initializeTheme();