import { useState } from 'react';
import { SettingsModal } from './components/SettingsModal';

export function App(): JSX.Element {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  return (
    <div style={{ 
      fontFamily: 'system-ui, sans-serif', 
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column'
    }}>
      <header style={{
        padding: '1rem 2rem',
        borderBottom: '1px solid #e0e0e0',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#fff'
      }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem' }}>CourseFlow</h1>
        <button
          onClick={() => setIsSettingsOpen(true)}
          style={{
            padding: '0.5rem 1rem',
            fontSize: '1rem',
            cursor: 'pointer',
            background: 'none',
            border: '1px solid #ccc',
            borderRadius: '4px',
          }}
          aria-label="Open settings"
        >
          ⚙ Settings
        </button>
      </header>
      
      <main style={{ 
        flex: 1, 
        padding: '2rem',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <p>Hello World from React + Electron + TypeScript!</p>
        <p>Assignments will appear here once iCal is configured.</p>
      </main>

      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
      />
    </div>
  );
}
