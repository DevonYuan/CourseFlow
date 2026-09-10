/**
 * Legend Component
 *
 * Explains the design decisions in the UI.
 * Matches: docs/design-inspo/courseflow-dashbar-redesign.html
 *
 * @module @frontend/components/Legend
 */

import './Legend.css';

interface LegendProps {
  /** Whether the legend is visible */
  visible?: boolean;
}

export function Legend({ visible = true }: LegendProps): JSX.Element | null {
  if (!visible) return null;

  const items = [
    {
      number: '1',
      title: 'Status lives in one place',
      description: 'The old "Show Completed" checkbox duplicated what the Completed tab already does. Removed it — the three tabs are now the single source of truth for what\'s showing.'
    },
    {
      number: '2',
      title: 'Sync collapses to one pill',
      description: '"Last sync" and "Next auto-sync" merge into a single two-line pill; tapping it triggers sync, so there\'s no separate button competing for space.'
    },
    {
      number: '3',
      title: 'Filters move to their own row',
      description: 'Course, due date, sort, and group are all "organize the list" actions, so they\'re grouped on a second row as compact dropdown chips instead of raw inputs and a stray toggle.'
    },
    {
      number: '4',
      title: 'Layout gets its own control',
      description: 'Flat vs. grouped view is a display preference, not a filter — it\'s pulled out into a small icon toggle on the right of the toolbar, away from the query chips.'
    }
  ];

  return (
    <div className="legend" role="region" aria-label="Design notes">
      {items.map((item) => (
        <div key={item.number} className="legend-item">
          <div className="legend-num">{item.number}</div>
          <div className="legend-body">
            <h4>{item.title}</h4>
            <p>{item.description}</p>
          </div>
        </div>
      ))}
    </div>
  );
}