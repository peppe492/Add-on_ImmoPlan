import React, { createContext, useContext, useEffect } from 'react';

export type AppTheme = 'DEFAULT' | 'NEON';

export interface ThemeContextType {
  theme: AppTheme;
  isNeon: boolean;
  setTheme: (theme: AppTheme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'DEFAULT',
  isNeon: false,
  setTheme: () => {},
  toggleTheme: () => {},
});

export interface ThemeProviderProps {
  children: React.ReactNode;
  theme?: AppTheme | undefined;
  onChangeTheme?: (theme: AppTheme) => void;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children, theme = 'DEFAULT', onChangeTheme }) => {
  const currentTheme = theme || 'DEFAULT';

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('theme-neon', 'dark');
    if (currentTheme === 'NEON') {
      root.classList.add('theme-neon', 'dark');
    }
  }, [currentTheme]);

  const setTheme = (newTheme: AppTheme) => {
    if (onChangeTheme) {
      onChangeTheme(newTheme);
    }
  };

  const toggleTheme = () => {
    const nextTheme = currentTheme === 'NEON' ? 'DEFAULT' : 'NEON';
    setTheme(nextTheme);
  };

  const isNeon = currentTheme === 'NEON';

  return (
    <ThemeContext.Provider value={{ theme: currentTheme, isNeon, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => useContext(ThemeContext);
