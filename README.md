# llm-stream-processor-js

A lightweight utility for processing streaming responses from Large Language Models (LLMs), with special handling for `<think>` blocks and content parsing.

## Features

- Process streaming LLM responses with callback-based event handling
- Intelligently parse and separate `<think>` blocks from final content
- Automatic JSON detection in content responses
- Support for chunk prefixes and end delimiters common in SSE streams
- Zero dependencies
- Works directly in the browser without bundling
- TypeScript declarations included

## Installation

### Direct inclusion in HTML

```html
<script src="https://cdn.jsdelivr.net/gh/mingzilla/llm-stream-processor-js@latest/llm-stream-processor.js"></script>
```

#### TypeScript Support for Direct Inclusion

If you're using TypeScript with direct script inclusion, you can reference the type definitions in one of these ways:

1. **Download the definition file** and place it in your project, then reference it in your `tsconfig.json`:

   ```json
   {
     "compilerOptions": {
       "typeRoots": ["./typings", "./node_modules/@types"]
     }
   }
   ```

   And create a folder structure:
   ```
   your-project/
   ├── typings/
   │   └── llm-stream-processor-js/
   │       └── index.d.ts  // Copy contents from llm-stream-processor.d.ts
   ```

2. **Reference the declaration file directly** using a triple-slash directive:

   ```typescript
   /// <reference path="./typings/llm-stream-processor.d.ts" />
   ```

3. **Use the CDN for the declaration file**:

   ```typescript
   // In your TypeScript file
   declare module 'llm-stream-processor-js';
   // Then add a reference in your HTML
   // <script src="https://cdn.jsdelivr.net/gh/mingzilla/llm-stream-processor-js@latest/llm-stream-processor.js"></script>
   ```

### NPM

```bash
npm install @mingzilla/llm-stream-processor-js
```

## Usage

### Basic Usage with Streaming API

It works well with [api-client-js](https://github.com/mingzilla/api-client-js).

```javascript
// Create a stream processor instance
const processor = LlmStreamProcessor.createInstance({
  chunkPrefix: "data: ",  // Optional: Strip this prefix from each chunk (common in SSE)
  endDelimiter: "[DONE]"  // Optional: String that signals the end of the stream
});

// Process streaming response from an LLM API
let contentWithoutThinkBlock;
ApiClient.stream(
  ApiClientInput.postJson('https://api.example.com/llm/generate', {
    prompt: "Explain quantum computing. <think>I should start with the basics.</think>"
  }, {
    'Accept': 'text/event-stream'
  }),
  () => console.log('Stream started'), // onStart
  (chunk) => {
    // Process each chunk through the LLM processor
    processor.read(
      chunk,
      () => console.log('Processing started'),
      () => console.log('Think block started'),
      (thinkChunk) => console.log('Think chunk:', thinkChunk),
      (fullThinkText) => console.log('Think complete:', fullThinkText),
      () => console.log('Content started'),
      (contentChunk) => {
        console.log('Content chunk:', contentChunk);
        // Update UI with new content
        document.getElementById('response').innerText += contentChunk;
      },
      (fullContent, parsedJson) => {
        console.log('Content complete:', fullContent);
        contentWithoutThinkBlock = fullContent;
      },
      (fullThink, fullContent, parsedJson) => console.log('All complete'),
      (error) => console.error('Error:', error)
    );
  },
  (fullResponse) => {
    // When the stream is complete, finalize processing. This triggers 'Content complete' to be executed
    processor.finalize();
    // if you want to exclude the <think> block from the fullResonse, do the below
    fullResponse.body = contentWithoutThinkBlock;
    // ...
  },
  (error) => {
    processor.finalize(); // if you want the error case to also trigger completion.
    console.error('Stream error:', error);
  }
);
```

### Handling Server-Sent Events (SSE)

Many LLM APIs use Server-Sent Events (SSE) for streaming. The processor can handle SSE format:

```javascript
const processor = LlmStreamProcessor.createInstance({
  chunkPrefix: "data: ",  // Remove "data: " prefix from SSE events
  endDelimiter: "[DONE]"  // Common end signal in SSE streams
});

// Now process chunks as they come in...
```

### Extracting JSON From Responses

The processor automatically attempts to parse JSON in the content:

```javascript
processor.read(
  chunk,
  // ...other callbacks...
  (fullContent, parsedJson) => {
    if (parsedJson) {
      // The response contained valid JSON
      console.log('Parsed JSON:', parsedJson);
      
      // For example, extracting choices from an OpenAI-like response
      if (parsedJson.choices && parsedJson.choices[0]) {
        const generatedText = parsedJson.choices[0].message.content;
        document.getElementById('response').innerText = generatedText;
      }
    }
  },
  // ...other callbacks...
);
```

## API Reference

### LlmStreamProcessor

The main class for processing LLM streaming responses.

#### Static Methods

- `createInstance(options)`: Create a new processor instance with optional configuration

#### Instance Methods

- `read(chunk, callbacks...)`: Process a chunk of text from the stream
- `finalize()`: Finalize processing and trigger completion callbacks

#### Configuration Options

When creating a processor with `createInstance()`, you can provide:

- `chunkPrefix`: String prefix to strip from each chunk (e.g., "data: " for SSE)
- `endDelimiter`: String that signals the end of the stream (e.g., "[DONE]")

#### Callback Parameters for `read()`

- `onStart`: Called when processing begins
- `onThinkStart`: Called when a think block starts
- `onThinkChunk`: Called with each chunk inside a think block
- `onThinkFinish`: Called when a think block completes
- `onContentStart`: Called when content outside think blocks starts
- `onContentChunk`: Called with each chunk outside think blocks
- `onContentFinish`: Called when content is finished, with optional parsed JSON
- `onAllComplete`: Called when all processing is complete
- `onError`: Called if an error occurs

## How It Works

1. The processor identifies `<think>` and `</think>` tags in the stream
2. Content inside these tags is separated and provided in think-related callbacks
3. Content outside these tags is treated as the actual response
4. When the stream completes, the processor attempts to parse any JSON in the content
5. All accumulated content is provided to completion callbacks

## License

MIT

## Author

Ming Huang (mingzilla)
