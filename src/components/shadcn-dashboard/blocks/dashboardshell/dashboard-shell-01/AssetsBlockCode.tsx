'use client'
import { CardContent, CardHeader, Card, CardTitle } from '@/components/ui/card';

import { Gamepad2, Swords, User, Users } from 'lucide-react';

type AssetCardProps = {
  title: string;
  value: string | number;
  icon: React.ComponentType<{ size?: number; className?: string }>;
};

function AssetCard({ title, value, icon: Icon }: AssetCardProps) {
  return (
    <div className='flex flex-col justify-between gap-6 p-6 bg-card'>
      <span className='inline-flex size-8 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground'>
        <Icon size={16} />
      </span>
      <div>
        <h6 className='text-2xl font-semibold tabular-nums'>
          {typeof value === "number" ? value.toLocaleString("fr-FR") : value}
        </h6>
        <p className='text-sm font-normal'>{title}</p>
      </div>
    </div>
  );
}

/**
 * Registry block, content-adapted: the four overview tiles are the
 * platform's real totals, passed from the server page.
 */
export default function TotalAssets({
  totalUsers,
  totalGamers,
  totalGames,
  totalMatches,
}: {
  totalUsers: number;
  totalGamers: number;
  totalGames: number;
  totalMatches: number;
}) {
  const tiles: AssetCardProps[] = [
    { title: 'Comptes', value: totalUsers, icon: Users },
    { title: 'Profils gamers', value: totalGamers, icon: User },
    { title: 'Jeux au catalogue', value: totalGames, icon: Gamepad2 },
    { title: 'Matchs joués', value: totalMatches, icon: Swords },
  ];

  return (
    <Card className="flex flex-col h-full gap-0 pb-0">
      <CardHeader className="border-b border-border">
        <div className="flex items-center gap-2">
          <CardTitle className="text-sm font-medium text-foreground">Plateforme</CardTitle>
        </div>
      </CardHeader>
      <CardContent className='h-full! px-0!'>
        <div className='h-full!'>
          <div className='grid grid-cols-2 h-full! gap-px bg-border'>
            {tiles.map((item) => (
              <AssetCard key={item.title} {...item} />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
