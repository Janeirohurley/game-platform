'use client'
import { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

/**
 * Registry block, content-adapted: greets the signed-in admin by name.
 * The demo's decorative controls (fake refresh/export/period select)
 * were removed — nothing on a control plane should be a dead button.
 */
export default function OverviewTab({ userName }: { userName: string }) {
  const [greeting, setGreeting] = useState('');

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- registry code:
       the greeting is time-of-day and MUST be computed on the client,
       a server render would freeze the wrong value and mismatch on
       hydration. */
    const hour = new Date().getHours();

    if (hour >= 5 && hour < 12) {
      setGreeting('Bonjour');
    } else if (hour >= 12 && hour < 17) {
      setGreeting('Bon après-midi');
    } else if (hour >= 17 && hour < 21) {
      setGreeting('Bonsoir');
    } else {
      setGreeting('Bonne nuit');
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  const night = greeting === 'Bonne nuit';

  return (
    <Card className="py-3 h-full gap-0">
      <CardContent className="flex items-center flex-wrap justify-between">
        <div className='flex flex-col items-start'>
          <h2 className="text-xl flex items-center gap-2">
            {greeting}, {userName}{' '}
            <span className="flex items-center">
              {night ? <Moon size={20} /> : <Sun size={20} className="text-orange-500" />}
            </span>
          </h2>
          <p className='text-sm font-normal text-muted-foreground'>
            Vue d&apos;ensemble de la plateforme — données réelles.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
