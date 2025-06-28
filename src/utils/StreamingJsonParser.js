/**
 * Simple streaming output processor for AI responses
 * Uses semantic tags and progressive text assembly instead of complex JSON streaming
 */

export class SimpleStreamProcessor {
  constructor() {
    this.reset();
  }

  reset() {
    this.chunks = [];
    this.currentSection = null;
    this.parsedContent = {
      header: '',
      bodyText: '',
      optionText: '',
      options: [],
    };
    this.isComplete = false;
  }

  /**
   * Process a streaming chunk and return formatted content
   */
  processChunk(chunk) {
    this.chunks.push(chunk);
    const fullText = this.chunks.join('');

    // Parse using semantic markdown patterns only
    this.parseIncrementalText(fullText);

    return {
      parsedData: this.parsedContent,
      isComplete: this.isComplete,
      displayText: this.buildDisplayText(),
    };
  }

  /**
   * Parse text progressively using semantic patterns
   */
  parseIncrementalText(text) {
    // Parse sections using markdown-like patterns
    const sections = this.extractSections(text);

    if (sections.header) {
      this.parsedContent.header = sections.header;
    }

    if (sections.body) {
      this.parsedContent.bodyText = sections.body;
    }

    if (sections.options && sections.options.length > 0) {
      this.parsedContent.options = sections.options;
      this.parsedContent.optionText = sections.optionPrompt || 'Choose your preferred option:';
    }

    // Check if response looks complete
    this.isComplete = this.checkCompleteness(text);
  }

  /**
   * Extract semantic sections from markdown-style text
   */
  extractSections(text) {
    const sections = {};

    // Extract header (first # heading)
    const headerMatch = text.match(/^#\s+(.+)$/m);
    if (headerMatch) {
      sections.header = headerMatch[1].trim();
    }

    // Extract numbered options
    const optionPattern =
      /^(\d+)\s*\.\s*\*\*(.+?)\*\*(?:\s*⭐\s*RECOMMENDED)?\s*[\r\n]([\s\S]*?)(?=^\d+\s*\.|$)/gm;
    const options = [];
    let optionMatch;

    while ((optionMatch = optionPattern.exec(text)) !== null) {
      const [fullMatch, id, title, description] = optionMatch;
      const isRecommended = fullMatch.includes('⭐ RECOMMENDED') || id === '1';
      options.push({
        id,
        title: title.trim(),
        description: description.trim().replace(/^\s*[-*]?\s*/, ''),
        recommended: isRecommended,
      });
    }

    if (options.length > 0) {
      sections.options = options;

      // Look for option prompt before the options
      const optionPromptMatch = text.match(
        /(?:^|\n)([^\n]*(?:choose|select|option|prefer)[^\n]*):?\s*(?=\n\s*1\.)/i
      );
      if (optionPromptMatch) {
        sections.optionPrompt = optionPromptMatch[1].trim();
      }
    }

    // Extract body text (everything between header and options, or just main content)
    let bodyStartIndex = 0;
    let bodyEndIndex = text.length;

    if (headerMatch) {
      bodyStartIndex = headerMatch.index + headerMatch[0].length;
    }

    if (options.length > 0) {
      // Find first option
      const firstOptionMatch = text.match(/^1\s*\./m);
      if (firstOptionMatch) {
        bodyEndIndex = firstOptionMatch.index;
        // Look backwards for option prompt
        const beforeOptions = text.substring(0, bodyEndIndex);
        const optionPromptMatch = beforeOptions.match(
          /([^\n]*(?:choose|select|option|prefer)[^\n]*):?\s*$/i
        );
        if (optionPromptMatch) {
          bodyEndIndex = optionPromptMatch.index;
        }
      }
    }

    const bodyText = text.substring(bodyStartIndex, bodyEndIndex).trim();
    if (bodyText) {
      sections.body = bodyText;
    }

    return sections;
  }

  /**
   * Check if the response appears complete
   */
  checkCompleteness(text) {
    // Simple heuristics to determine if response is complete
    const lines = text.split('\n');
    const lastLine = lines[lines.length - 1]?.trim();

    // If there are options, check if they seem complete
    if (this.parsedContent.options.length > 0) {
      const hasCustomOption = text.includes('custom') || text.includes('own response');
      return hasCustomOption || text.includes('💬') || lastLine.endsWith('.');
    }

    // For non-option responses, check for natural endings
    return lastLine.endsWith('.') || lastLine.endsWith('?') || lastLine.endsWith('!');
  }

  /**
   * Build display text from parsed content
   */
  buildDisplayText() {
    let displayText = '';

    if (this.parsedContent.header) {
      displayText += `# ${this.parsedContent.header}\n\n`;
    }

    if (this.parsedContent.bodyText) {
      displayText += this.parsedContent.bodyText;
    }

    if (this.parsedContent.optionText && this.parsedContent.options.length > 0) {
      displayText += `\n\n---\n\n**${this.parsedContent.optionText}**`;
    }

    return displayText;
  }

  /**
   * Get processed options
   */
  getOptions() {
    if (!this.parsedContent.options || this.parsedContent.options.length === 0) {
      return [];
    }

    const processedOptions = this.parsedContent.options.map((option, index) => ({
      value: option.id || option.value || String(index + 1),
      title: option.title,
      description: option.description || '',
      isRecommended: option.recommended || false,
    }));

    // Add custom response option
    processedOptions.push({
      value: 'custom',
      title: 'Enter your own response',
      description: '',
      isRecommended: false,
    });

    return processedOptions;
  }

  /**
   * Check if response has options
   */
  hasOptions() {
    return this.parsedContent.options && this.parsedContent.options.length > 0;
  }
}

// Legacy compatibility - provide the old StreamingJsonParser interface
export class StreamingJsonParser extends SimpleStreamProcessor {
  constructor() {
    super();
  }

  // Keep the old interface for backward compatibility
  get parsedData() {
    return this.parsedContent;
  }

  set parsedData(data) {
    this.parsedContent = data;
  }
}
