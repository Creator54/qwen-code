/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { Content } from '@google/genai';
import { QWEN_DIR } from '../utils/paths.js';

export const CONVERSATION_CONTEXT_FILENAME = 'context.md';

/**
 * Manages conversation context persistence across sessions.
 * 
 * This class handles saving and loading conversation history to/from a markdown file
 * in the project directory, allowing the tool to maintain context between sessions.
 */
export class ConversationContext {
  private readonly contextFilePath: string;
  private conversationHistory: Content[] = [];

  constructor(projectDir: string) {
    const qwenDir = path.join(projectDir, QWEN_DIR);
    this.contextFilePath = path.join(qwenDir, CONVERSATION_CONTEXT_FILENAME);
  }

  /**
   * Loads conversation history from the context file if it exists.
   * @returns Array of Content objects representing the conversation history
   */
  async loadContext(): Promise<Content[]> {
    try {
      await fs.access(this.contextFilePath);
      // For now, we'll return the in-memory history since we're not parsing the markdown back to Content objects
      // In a more advanced implementation, we could parse the markdown format back to Content objects
      return [...this.conversationHistory]; // Return a copy to prevent direct modification
    } catch (error) {
      // If file doesn't exist or can't be read, return empty history
      const err = error as NodeJS.ErrnoException;
      if (err.code === 'ENOENT') {
        // File doesn't exist, which is fine - we'll create it when needed
        return [];
      }
      console.warn(`Warning: Could not load conversation context from ${this.contextFilePath}:`, error);
      return [];
    }
  }

  /**
   * Appends a new interaction to the conversation context file.
   * @param content The new content to add to the conversation history
   */
  async appendToContext(content: Content): Promise<void> {
    try {
      // Add to in-memory history
      this.conversationHistory.push(content);
      
      // Format the content for the markdown file
      const formattedEntry = this.formatContentEntry(content);
      
      // Ensure directory exists
      await fs.mkdir(path.dirname(this.contextFilePath), { recursive: true });
      
      // Check if file exists and has content
      let shouldAddHeader = false;
      try {
        await fs.access(this.contextFilePath);
      } catch (error) {
        // File doesn't exist, we need to add header
        shouldAddHeader = true;
      }
      
      if (shouldAddHeader) {
        const header = this.generateFileHeader();
        await fs.writeFile(this.contextFilePath, header, 'utf-8');
      }
      
      // Append to file
      await fs.appendFile(this.contextFilePath, formattedEntry, 'utf-8');
    } catch (error) {
      console.warn(`Warning: Could not append to conversation context file ${this.contextFilePath}:`, error);
    }
  }

  /**
   * Clears the conversation context file and in-memory history.
   */
  async clearContext(): Promise<void> {
    try {
      this.conversationHistory = [];
      const header = this.generateFileHeader();
      await fs.mkdir(path.dirname(this.contextFilePath), { recursive: true });
      await fs.writeFile(this.contextFilePath, header, 'utf-8');
    } catch (error) {
      console.warn(`Warning: Could not clear conversation context file ${this.contextFilePath}:`, error);
    }
  }

  /**
   * Gets the current conversation history.
   * @returns Copy of the current conversation history
   */
  getHistory(): Content[] {
    return [...this.conversationHistory]; // Return a copy to prevent direct modification
  }

  /**
   * Checks if the conversation context file exists.
   * @returns True if the context file exists, false otherwise
   */
  async contextFileExists(): Promise<boolean> {
    try {
      await fs.access(this.contextFilePath);
      return true;
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      return err.code !== 'ENOENT';
    }
  }

  /**
   * Formats a Content object as a markdown entry.
   * @param content The Content object to format
   * @returns Formatted markdown string
   */
  private formatContentEntry(content: Content): string {
    const timestamp = new Date().toISOString();
    const role = content.role || 'unknown';
    
    let contentText = '';
    if (content.parts) {
      contentText = content.parts
        .map(part => {
          if (typeof part === 'string') {
            return part;
          } else if (part && typeof part === 'object' && 'text' in part) {
            return part.text || '';
          } else if (part && typeof part === 'object' && 'functionCall' in part) {
            return `[Function Call: ${JSON.stringify(part.functionCall)}]`;
          } else if (part && typeof part === 'object' && 'functionResponse' in part) {
            return `[Function Response: ${JSON.stringify(part.functionResponse)}]`;
          }
          return `[Unknown Part Type: ${JSON.stringify(part)}]`;
        })
        .join('\n');
    }

    // Escape only the most problematic markdown characters
    contentText = contentText.replace(/([`*])/g, '\\$1');
    
    return `\n## ${role.charAt(0).toUpperCase() + role.slice(1)} (${timestamp})\n\n${contentText}\n\n---\n`;
  }

  /**
   * Generates the file header for a new context file.
   * @returns Markdown header string
   */
  private generateFileHeader(): string {
    const timestamp = new Date().toISOString();
    return `# Qwen Code Conversation Context\n\nThis file contains the conversation history for this project.\nIt allows Qwen Code to maintain context between sessions.\n\nLast updated: ${timestamp}\n\n---\n`;
  }
}