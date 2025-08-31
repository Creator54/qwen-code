/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { ConversationContext, CONVERSATION_CONTEXT_FILENAME } from './conversationContext.js';
import { Content } from '@google/genai';

describe('ConversationContext', () => {
  const testDir = path.join(process.cwd(), 'test-conversation-context');
  let conversationContext: ConversationContext;

  beforeEach(async () => {
    // Create a test directory
    await fs.mkdir(testDir, { recursive: true });
    conversationContext = new ConversationContext(testDir);
  });

  afterEach(async () => {
    // Clean up test directory
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('should create a new context file when it does not exist', async () => {
    const exists = await conversationContext.contextFileExists();
    expect(exists).toBe(false);

    // Add some content to create the file
    const content: Content = {
      role: 'user',
      parts: [{ text: 'Hello, world!' }],
    };
    await conversationContext.appendToContext(content);

    const existsAfter = await conversationContext.contextFileExists();
    expect(existsAfter).toBe(true);

    // Check that the file was created with the correct header
    const qwenDir = path.join(testDir, '.qwen');
    const filePath = path.join(qwenDir, CONVERSATION_CONTEXT_FILENAME);
    const fileContent = await fs.readFile(filePath, 'utf-8');
    expect(fileContent).toContain('# Qwen Code Conversation Context');
  });

  it('should load empty history when context file does not exist', async () => {
    const history = await conversationContext.loadContext();
    expect(history).toEqual([]);
  });

  it('should append content to the context file', async () => {
    const userContent: Content = {
      role: 'user',
      parts: [{ text: 'What is the weather today?' }],
    };

    const modelContent: Content = {
      role: 'model',
      parts: [{ text: 'The weather is sunny.' }],
    };

    await conversationContext.appendToContext(userContent);
    await conversationContext.appendToContext(modelContent);

    // Check that the content was appended to the file
    const qwenDir = path.join(testDir, '.qwen');
    const filePath = path.join(qwenDir, CONVERSATION_CONTEXT_FILENAME);
    const fileContent = await fs.readFile(filePath, 'utf-8');
    
    expect(fileContent).toContain('## User');
    expect(fileContent).toContain('What is the weather today?');
    expect(fileContent).toContain('## Model');
    expect(fileContent).toContain('The weather is sunny.');
  });

  it('should maintain in-memory history', async () => {
    const userContent: Content = {
      role: 'user',
      parts: [{ text: 'Hello' }],
    };

    await conversationContext.appendToContext(userContent);
    
    const history = conversationContext.getHistory();
    expect(history).toHaveLength(1);
    expect(history[0]).toEqual(userContent);
  });

  it('should clear context and create new file', async () => {
    // Add some content first
    const userContent: Content = {
      role: 'user',
      parts: [{ text: 'Test content' }],
    };
    await conversationContext.appendToContext(userContent);

    // Verify content was added
    let history = await conversationContext.loadContext();
    expect(history).toHaveLength(1);

    // Clear context
    await conversationContext.clearContext();

    // Verify context is cleared
    history = conversationContext.getHistory();
    expect(history).toHaveLength(0);

    // Verify file exists but is empty of content (except header)
    const qwenDir = path.join(testDir, '.qwen');
    const filePath = path.join(qwenDir, CONVERSATION_CONTEXT_FILENAME);
    const fileContent = await fs.readFile(filePath, 'utf-8');
    expect(fileContent).toContain('# Qwen Code Conversation Context');
  });
});