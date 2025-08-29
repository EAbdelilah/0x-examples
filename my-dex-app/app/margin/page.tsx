'use client';

import React from 'react';
import OpenPositionForm from '../components/OpenPositionForm';
import PositionsView from '../components/PositionsView';

export default function MarginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24">
      <div className="z-10 w-full max-w-5xl items-center justify-between font-mono text-sm lg:flex">
        <h1 className="text-4xl font-bold text-center">Margin Trading</h1>
      </div>

      <div className="w-full max-w-5xl mt-8">
        <OpenPositionForm />
        <PositionsView />
      </div>
    </main>
  );
}
