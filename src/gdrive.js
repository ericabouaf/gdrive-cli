#!/usr/bin/env node

import { Command } from 'commander';
import { authCommand } from './commands/auth.js';
import { fileCommand } from './commands/file.js';
import { setProfile } from './lib/auth.js';

const program = new Command();

program
  .name('gdrive')
  .description('Google Drive CLI tool')
  .version('1.0.0')
  .option('--profile <name>', 'Profile to use', 'default');

// Set profile before any command runs
program.hook('preAction', () => {
  setProfile(program.opts().profile);
});

// Add subcommands
program.addCommand(authCommand);
program.addCommand(fileCommand);

program.parse();
