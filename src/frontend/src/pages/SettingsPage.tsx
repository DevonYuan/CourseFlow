/**
 * SettingsPage — Settings Page Component
 *
 * Full-page settings view that wraps the SettingsModal component.
 * Provides a dedicated page for settings accessible via routing.
 *
 * @module @frontend/pages/SettingsPage
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { SettingsModal } from '../components/SettingsModal';

/**
 * SettingsPage - Full page settings view.
 * Renders SettingsModal in open state with navigation back to assignments list on close.
 */
export function SettingsPage(): JSX.Element {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(true);

  // Navigate back to assignments list when modal closes
  useEffect(() => {
    if (!isOpen) {
      void navigate('/');
    }
  }, [isOpen, navigate]);

  return <SettingsModal isOpen={isOpen} onClose={() => setIsOpen(false)} />;
}
