import { Injectable } from '@nestjs/common';
import { OddixCreativeTheme } from './oddix-creative.service';

export type OddixCardStyle = {
  theme: OddixCreativeTheme;
  primary: string;
  secondary: string;
  accent: string;
  glow: string;
  logoSize: number;
  title: string;
};

@Injectable()
export class OddixCardStyleService {
  getStyle(theme: OddixCreativeTheme): OddixCardStyle {
    const styles: Record<OddixCreativeTheme, OddixCardStyle> = {
      VIP_GOLD: {
        theme,
        primary: '#facc15',
        secondary: '#111827',
        accent: '#22c55e',
        glow: '#f59e0b',
        logoSize: 172,
        title: 'ODDIX PRO AI',
      },
      VIP_CHAMPIONS: {
        theme,
        primary: '#facc15',
        secondary: '#172554',
        accent: '#38bdf8',
        glow: '#2563eb',
        logoSize: 176,
        title: 'ODDIX CHAMPIONS',
      },
      VIP_DARK: {
        theme,
        primary: '#fb923c',
        secondary: '#09090b',
        accent: '#ef4444',
        glow: '#f97316',
        logoSize: 168,
        title: 'ODDIX DARK',
      },
      VIP_PRO: {
        theme,
        primary: '#22d3ee',
        secondary: '#020617',
        accent: '#facc15',
        glow: '#06b6d4',
        logoSize: 174,
        title: 'ODDIX PRO AI',
      },
      VIP_GREEN: {
        theme,
        primary: '#22c55e',
        secondary: '#052e16',
        accent: '#facc15',
        glow: '#16a34a',
        logoSize: 176,
        title: 'ODDIX GREEN',
      },
      VIP_ELITE: {
        theme,
        primary: '#fb923c',
        secondary: '#111827',
        accent: '#facc15',
        glow: '#ea580c',
        logoSize: 180,
        title: 'ODDIX ELITE',
      },
      VIP_LUXURY: {
        theme,
        primary: '#eab308',
        secondary: '#18181b',
        accent: '#a855f7',
        glow: '#facc15',
        logoSize: 172,
        title: 'ODDIX LUXURY',
      },
      VIP_GAMER: {
        theme,
        primary: '#a3e635',
        secondary: '#1e1b4b',
        accent: '#a855f7',
        glow: '#84cc16',
        logoSize: 178,
        title: 'ODDIX GAMER',
      },
    };

    return styles[theme] || styles.VIP_GOLD;
  }
}