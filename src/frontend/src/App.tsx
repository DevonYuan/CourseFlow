import { useState } from 'react';

export function App(): JSX.Element {
  const [count, setCount] = useState(0);

  return (
    <div style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
      <h1>CourseFlow</h1>
      <p>Hello World from React + Electron + TypeScript!</p>
      <button
        onClick={() => setCount(count + 1)}
        style={{
          padding: '0.5rem 1rem',
          fontSize: '1rem',
          cursor: 'pointer',
        }}
      >
        Clicked {count} times
      </button>
    </div>
  );
}
