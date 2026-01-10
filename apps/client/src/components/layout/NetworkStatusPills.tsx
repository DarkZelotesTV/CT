import { useState } from 'react';
import classNames from 'classnames';

import { Popover, PopoverContent, PopoverTrigger } from '../ui';

interface NetworkStatusPillsProps {
  pingDisplay: number;
  lossDisplay: string;
  lossTone: string;
  uptimeDisplay: string;
}

export const NetworkStatusPills = ({ pingDisplay, lossDisplay, lossTone, uptimeDisplay }: NetworkStatusPillsProps) => {
  const [lossOpen, setLossOpen] = useState(false);
  const [uptimeOpen, setUptimeOpen] = useState(false);

  return (
    <div className="telemetry-bar no-drag hidden md:flex gap-3">
      <div className="t-item">
        <span className="t-label">PING</span>
        <span className="t-val text-emerald-200">{pingDisplay}ms</span>
      </div>
      <div className="t-item">
        <Popover open={lossOpen} onOpenChange={setLossOpen}>
          <PopoverTrigger>
            <button
              type="button"
              className="t-label t-label-button"
              onMouseEnter={() => setLossOpen(true)}
              onMouseLeave={() => setLossOpen(false)}
              onFocus={() => setLossOpen(true)}
              onBlur={() => setLossOpen(false)}
            >
              LOSS
            </button>
          </PopoverTrigger>
          <PopoverContent
            className="telemetry-tooltip"
            role="tooltip"
            aria-live="polite"
          >
            Paketverlust in Prozent der übertragenen Daten.
          </PopoverContent>
        </Popover>
        <span className={classNames('t-val', lossTone)}>{lossDisplay}</span>
      </div>
      <div className="t-item">
        <Popover open={uptimeOpen} onOpenChange={setUptimeOpen}>
          <PopoverTrigger>
            <button
              type="button"
              className="t-label t-label-button"
              onMouseEnter={() => setUptimeOpen(true)}
              onMouseLeave={() => setUptimeOpen(false)}
              onFocus={() => setUptimeOpen(true)}
              onBlur={() => setUptimeOpen(false)}
            >
              UPTIME
            </button>
          </PopoverTrigger>
          <PopoverContent
            className="telemetry-tooltip"
            role="tooltip"
            aria-live="polite"
          >
            Laufzeit seit der letzten Verbindung.
          </PopoverContent>
        </Popover>
        <span className="t-val text-text" id="time">
          {uptimeDisplay}
        </span>
      </div>
    </div>
  );
};
