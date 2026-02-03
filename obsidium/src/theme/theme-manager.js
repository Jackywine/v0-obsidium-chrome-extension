/**
 * Obsidium Theme Manager
 * Handles light/dark mode switching with system preference support
 */

const THEME_KEY = 'obsidium-theme';

class ThemeManager {
  constructor() {
    this.currentTheme = 'system';
    this.listeners = new Set();
    this.mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    // Listen for system theme changes
    this.mediaQuery.addEventListener('change', (e) => {
      if (this.currentTheme === 'system') {
        this.applyTheme(e.matches ? 'dark' : 'light');
      }
    });
  }

  /**
   * Initialize theme from storage
   */
  async init() {
    try {
      const stored = localStorage.getItem(THEME_KEY);
      if (stored) {
        this.currentTheme = stored;
      }
      this.apply();
    } catch (e) {
      console.error('Failed to load theme preference:', e);
      this.apply();
    }
  }

  /**
   * Get the effective theme (resolved system preference)
   */
  getEffectiveTheme() {
    if (this.currentTheme === 'system') {
      return this.mediaQuery.matches ? 'dark' : 'light';
    }
    return this.currentTheme;
  }

  /**
   * Apply the current theme to the document
   */
  apply() {
    const effectiveTheme = this.getEffectiveTheme();
    this.applyTheme(effectiveTheme);
  }

  /**
   * Apply a specific theme
   */
  applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    
    // Update meta theme-color
    let metaTheme = document.querySelector('meta[name="theme-color"]');
    if (!metaTheme) {
      metaTheme = document.createElement('meta');
      metaTheme.name = 'theme-color';
      document.head.appendChild(metaTheme);
    }
    metaTheme.content = theme === 'dark' ? '#000000' : '#FFFFFF';

    // Notify listeners
    this.notifyListeners(theme);
  }

  /**
   * Set theme preference
   */
  setTheme(theme) {
    if (!['light', 'dark', 'system'].includes(theme)) {
      console.error('Invalid theme:', theme);
      return;
    }

    this.currentTheme = theme;
    
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch (e) {
      console.error('Failed to save theme preference:', e);
    }

    this.apply();
  }

  /**
   * Toggle between light and dark
   */
  toggle() {
    const current = this.getEffectiveTheme();
    this.setTheme(current === 'dark' ? 'light' : 'dark');
  }

  /**
   * Cycle through themes: light -> dark -> system
   */
  cycle() {
    const themes = ['light', 'dark', 'system'];
    const currentIndex = themes.indexOf(this.currentTheme);
    const nextIndex = (currentIndex + 1) % themes.length;
    this.setTheme(themes[nextIndex]);
  }

  /**
   * Get current theme setting
   */
  getTheme() {
    return this.currentTheme;
  }

  /**
   * Check if current theme is dark
   */
  isDark() {
    return this.getEffectiveTheme() === 'dark';
  }

  /**
   * Add theme change listener
   */
  addListener(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * Remove theme change listener
   */
  removeListener(callback) {
    this.listeners.delete(callback);
  }

  /**
   * Notify all listeners of theme change
   */
  notifyListeners(theme) {
    this.listeners.forEach(callback => {
      try {
        callback(theme);
      } catch (e) {
        console.error('Theme listener error:', e);
      }
    });
  }
}

// Export singleton instance
export const themeManager = new ThemeManager();
export default themeManager;
