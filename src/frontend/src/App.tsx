import { useState } from 'react';
import { SettingsModal } from './components/SettingsModal';
import { AssignmentList } from './components/AssignmentList';

export function App(): JSX.Element {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const handleOpenSettings = () => {
    setIsSettingsOpen(true);
  };

  return (
    <div style={{ 
      fontFamily: 'system-ui, sans-serif', 
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column'
    }}>
      <header style={{
        padding: '1rem 2rem',
        borderBottom: '1px solid var(--border-color, #e0e0e0)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: 'var(--surface-color, #fff)'
      }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem' }}>CourseFlow</h1>
        <button
          onClick={() => setIsSettingsOpen(true)}
          style={{
            padding: '0.5rem 1rem',
            fontSize: '1rem',
            cursor: 'pointer',
            background: 'none',
            border: '1px solid var(--border-color, #ccc)',
            borderRadius: '4px',
            color: 'var(--text-primary, #1a1a1a)',
          }}
          aria-label="Open settings"
        >
          ⚙ Settings
        </button>
      </header>
      
      <main style={{ 
        flex: 1, 
        padding: '1rem',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}>
        <AssignmentList 
          onOpenSettings={handleOpenSettings}
        />
      </main>

      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
      />
    </div>
  );
}
