"use client";

import { cn } from "../../lib/utils";
import UnicornScene from "unicornstudio-react";

export const BloomBackground = () => {
  return (
    <div className={cn("absolute inset-0 pointer-events-none overflow-hidden z-0")}>
      <UnicornScene 
        production={true} 
        projectId="9tVO0xGS8DIar1DF4Sqc" 
        width="100vw" 
        height="100vh" 
      />
    </div>
  );
};