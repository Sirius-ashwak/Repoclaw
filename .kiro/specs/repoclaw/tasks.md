# Implementation Plan: RepoClaw

## Overview

This implementation plan breaks down the RepoClaw multi-agent system into discrete coding tasks. The approach follows a bottom-up strategy: establish core infrastructure, implement individual agents, build the orchestration layer, create the frontend, and finally integrate everything with approval gates and exports.

The implementation uses TypeScript with Next.js 14, LangGraph for agent orchestration, and integrates with GitHub and Vercel APIs.

## Tasks

- [x] 1. Set up project structure and core infrastructure
  - Initialize Next.js 14 project with TypeScript and App Router
  - Install dependencies: shadcn/ui, LangGraph, Vercel AI SDK, Octokit, fast-check
  - Configure Vercel KV for session storage
  - Set up environment variables for GitHub OAuth, Vercel API, and LLM API keys
  - Create base TypeScript interfaces for agents, artifacts, and pipeline state
  - _Requirements: 1.1, 11.1_

- [x] 2. Implement GitHub authentication and repository connection
  - [x] 2.1 Create GitHub URL validation utility
    - Write validation function for GitHub URL format (https://github.com/owner/repo)
    - Extract owner and repo name from valid URLs
    - _Requirements: 1.2_
  
  - [x] 2.2 Write property test for URL validation
    - **Property 1: GitHub URL Validation**
    - **Validates: Requirements 1.2**
  
  - [x] 2.3 Implement GitHub OAuth flow
    - Create API route for initiating OAuth (/api/repo/connect)
    - Handle OAuth callback and token exchange
    - Store tokens securely in Vercel KV with session ID
    - _Requirements: 1.3, 1.5_
  
  - [x] 2.4 Write property test for OAuth trigger
    - **Property 2: OAuth Trigger for Valid URLs**
    - **Validates: Requirements 1.3**
  
  - [x] 2.5 Implement repository metadata retrieval
    - Use Octokit to fetch repo metadata (owner, name, default branch, visibility)
    - Store metadata in session state
    - _Requirements: 1.5_
  
  - [x] 2.6 Write property test for metadata retrieval
    - **Property 3: Metadata Retrieval After Authentication**
    - **Validates: Requirements 1.5**
  
  - [x] 2.7 Write unit tests for authentication error handling
    - Test OAuth failure scenarios
    - Test invalid token handling
    - _Requirements: 1.4_

- [x] 3. Implement AnalyzeAgent
  - [x] 3.1 Create AnalyzeAgent class with base agent interface
    - Implement execute method signature
    - Set up Octokit integration for file retrieval
    - _Requirements: 2.1_
  
  - [x] 3.2 Implement stack detection logic
    - Fetch and parse package.json
    - Identify primary language and framework from dependencies
    - Detect package manager (npm, yarn, pnpm)
    - _Requirements: 2.1, 2.2_
  
  - [x] 3.3 Write property test for stack detection
    - **Property 4: Stack Detection**
    - **Validates: Requirements 2.1, 2.2**
  
  - [x] 3.4 Implement documentation gap analysis
    - Check for README existence
    - Analyze README sections (installation, usage, description)
    - _Requirements: 2.5_
  
  - [x] 3.5 Write property test for documentation gap detection
    - **Property 5: Documentation Gap Detection**
    - **Validates: Requirements 2.5**
  
  - [x] 3.6 Implement test file detection
    - Search for test directories (test/, tests/, __tests__)
    - Identify test files by pattern (*.test.*, *.spec.*)
    - _Requirements: 2.6_
  
  - [x] 3.7 Write property test for test file detection
    - **Property 6: Test File Detection**
    - **Validates: Requirements 2.6**
  
  - [x] 3.8 Create analysis artifact output
    - Format analysis results as AnalysisArtifact
    - Include stack info, issues, recommendations
    - _Requirements: 2.8_
  
  - [x] 3.9 Write unit tests for unsupported stack handling
    - Test non-Node.js repositories
    - Verify error message display
    - _Requirements: 2.4_

- [x] 4. Checkpoint - Verify AnalyzeAgent functionality
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implement DocsAgent
  - [x] 5.1 Create DocsAgent class with base agent interface
    - Implement execute method signature
    - Set up LLM integration (Grok via Vercel AI SDK)
    - _Requirements: 4.1_
  
  - [x] 5.2 Implement README analysis and generation
    - Fetch existing README content
    - Generate improved README via LLM with structured prompt
    - Include project overview, installation, usage, stack info
    - _Requirements: 4.1, 4.2, 4.3_
  
  - [x] 5.3 Write property test for README content completeness
    - **Property 8: README Content Completeness**
    - **Validates: Requirements 4.2, 4.3**
  
  - [x] 5.4 Implement conditional demo link inclusion
    - Check if demo artifact exists from DemoAgent
    - Include demo URL in README if available
    - _Requirements: 4.4_
  
  - [x] 5.5 Write property test for conditional demo link inclusion
    - **Property 9: Conditional Demo Link Inclusion**
    - **Validates: Requirements 4.4**
  
  - [x] 5.6 Implement API documentation generation
    - Scan for API route files (pages/api/*, app/api/*)
    - Extract endpoint information (method, path, parameters)
    - Generate API documentation markdown
    - _Requirements: 4.5_
  
  - [x] 5.7 Write property test for API documentation generation
    - **Property 10: API Documentation Generation**
    - **Validates: Requirements 4.5**
  
  - [x] 5.8 Create diff generation utility
    - Generate line-by-line diff between original and generated content
    - Format as DiffContent with hunks and lines
    - _Requirements: 4.6_
  
  - [x] 5.9 Create docs artifacts output
    - Format README and API docs as artifacts
    - Include original, generated, and diff content
    - _Requirements: 4.6_

- [x] 6. Implement DemoAgent
  - [x] 6.1 Create DemoAgent class with base agent interface
    - Implement execute method signature
    - Set up Vercel API client
    - _Requirements: 5.1_
  
  - [x] 6.2 Implement build configuration validation
    - Check for package.json with build script
    - Validate required dependencies are present
    - _Requirements: 5.1_
  
  - [x] 6.3 Write property test for build configuration validation
    - **Property 11: Build Configuration Validation**
    - **Validates: Requirements 5.1**
  
  - [x] 6.4 Implement Vercel deployment creation
    - Create deployment via Vercel API
    - Poll deployment status until ready or failed
    - Handle deployment errors and capture logs
    - _Requirements: 5.2_
  
  - [x] 6.5 Write property test for Vercel deployment creation
    - **Property 12: Vercel Deployment Creation**
    - **Validates: Requirements 5.2**
  
  - [x] 6.6 Implement deployment accessibility validation
    - Make HTTP request to deployed URL
    - Verify successful response (200 status)
    - _Requirements: 5.7_
  
  - [x] 6.7 Write property test for deployment accessibility validation
    - **Property 14: Deployment Accessibility Validation**
    - **Validates: Requirements 5.7**
  
  - [x] 6.8 Implement QR code generation
    - Generate QR code for demo URL using qrcode library
    - Return base64-encoded image
    - _Requirements: 5.6_
  
  - [x] 6.9 Write property test for QR code generation
    - **Property 13: QR Code Generation**
    - **Validates: Requirements 5.6**
  
  - [x] 6.10 Create demo artifact output
    - Format demo URL, QR code, deployment ID as artifact
    - Include deployment status and logs
    - _Requirements: 5.5_
  
  - [x] 6.11 Write unit tests for deployment failure handling
    - Test build failures with error logs
    - Test deployment timeout scenarios
    - _Requirements: 5.4_

- [x] 7. Implement PitchAgent
  - [x] 7.1 Create PitchAgent class with base agent interface
    - Implement execute method signature
    - Set up LLM integration for content generation
    - _Requirements: 6.1_
  
  - [x] 7.2 Implement repository purpose analysis
    - Analyze README and code structure
    - Extract key features and functionality
    - _Requirements: 6.1_
  
  - [x] 7.3 Implement architecture diagram generation
    - Generate Mermaid diagram code via LLM
    - Render Mermaid to SVG
    - _Requirements: 6.2_
  
  - [x] 7.4 Implement slide deck generation
    - Generate slide content via LLM (title, content, layout)
    - Create 5-7 slides covering overview, features, tech stack, demo
    - _Requirements: 6.3_
  
  - [x] 7.5 Implement pitch script generation
    - Generate presentation script with talking points
    - Tailor to selected mode (Hackathon/Placement/Refactor)
    - _Requirements: 6.4_
  
  - [x] 7.6 Write property test for pitch artifact generation
    - **Property 15: Pitch Artifact Generation**
    - **Validates: Requirements 6.2, 6.3, 6.4**
  
  - [x] 7.7 Create pitch artifacts output
    - Format diagram, slide deck, and script as artifacts
    - _Requirements: 6.7_

- [x] 8. Checkpoint - Verify all agents work independently
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Implement SupervisorAgent and orchestration
  - [x] 9.1 Create SupervisorAgent class with base agent interface
    - Implement execute method signature
    - Set up LangGraph for agent orchestration
    - _Requirements: 11.1_
  
  - [x] 9.2 Implement agent initialization sequence
    - Initialize agents in order: Analyze → Docs → Demo → Pitch
    - Pass context between agents
    - _Requirements: 11.1_
  
  - [x] 9.3 Write property test for agent initialization sequence
    - **Property 24: Agent Initialization Sequence**
    - **Validates: Requirements 11.1**
  
  - [x] 9.4 Implement agent output validation
    - Validate each agent's output structure
    - Check required fields are present
    - _Requirements: 11.2_
  
  - [x] 9.5 Write property test for output validation
    - **Property 25: Output Validation Before Proceeding**
    - **Validates: Requirements 11.2**
  
  - [x] 9.6 Implement failure monitoring
    - Detect agent errors and timeouts
    - Update pipeline status on failure
    - _Requirements: 11.5_
  
  - [x] 9.7 Write property test for failure monitoring
    - **Property 27: Failure Monitoring**
    - **Validates: Requirements 11.5**
  
  - [x] 9.8 Implement final deliverable compilation
    - Collect all artifacts from completed agents
    - Create final deliverables object
    - _Requirements: 11.4_
  
  - [x] 9.9 Write property test for final deliverable compilation
    - **Property 26: Final Deliverable Compilation**
    - **Validates: Requirements 11.4**
  
  - [x] 9.10 Implement branch compilation for PR
    - Create new Git branch via GitHub API
    - Apply all file changes to branch
    - _Requirements: 7.1_
  
  - [x] 9.11 Write property test for branch compilation
    - **Property 16: Branch Compilation**
    - **Validates: Requirements 7.1**
  
  - [x] 9.12 Implement PR generation
    - Generate PR title, body, and checklist
    - Create PR via GitHub API
    - _Requirements: 7.2, 7.3_
  
  - [x] 9.13 Write property test for PR content completeness
    - **Property 17: PR Content Completeness**
    - **Validates: Requirements 7.2, 7.3**
  
  - [x] 9.14 Implement PR check validation
    - Wait for GitHub checks to complete
    - Validate lint and test checks pass
    - _Requirements: 7.7, 7.8_
  
  - [x] 9.15 Write property test for PR check validation
    - **Property 19: PR Check Validation**
    - **Validates: Requirements 7.7, 7.8**

- [x] 10. Implement mode selection and configuration
  - [x] 10.1 Create mode configuration system
    - Define mode-specific agent priorities
    - Configure LLM prompts based on mode
    - _Requirements: 3.2, 3.3, 3.4_
  
  - [x] 10.2 Write property test for mode configuration
    - **Property 7: Mode Configuration**
    - **Validates: Requirements 3.2, 3.3, 3.4**
  
  - [x] 10.3 Create ModeSelector component
    - Display three mode cards with descriptions
    - Handle mode selection and pass to pipeline
    - _Requirements: 3.1_

- [x] 11. Implement API routes
  - [x] 11.1 Create POST /api/repo/connect route
    - Handle repository URL submission
    - Initiate OAuth flow
    - Create session in Vercel KV
    - _Requirements: 1.1, 1.2, 1.3_
  
  - [x] 11.2 Create POST /api/pipeline/start route
    - Validate session exists
    - Initialize SupervisorAgent with mode
    - Create pipeline state in Vercel KV
    - Return SSE endpoint
    - _Requirements: 3.5, 11.1_
  
  - [x] 11.3 Create GET /api/pipeline/stream route
    - Establish SSE connection
    - Stream pipeline events (agent start/complete/fail, artifacts, approval gates)
    - Handle client reconnection
    - _Requirements: 8.7_
  
  - [x] 11.4 Write property test for progress board state reflection
    - **Property 20: Progress Board State Reflection**
    - **Validates: Requirements 8.2, 8.3, 8.5, 8.7**
  
  - [x] 11.5 Create POST /api/approval/respond route
    - Handle approval/rejection at gates
    - Update pipeline state
    - Trigger regeneration or resume pipeline
    - _Requirements: 4.7, 7.4, 7.5_
  
  - [x] 11.6 Write property test for PR creation after approval
    - **Property 18: PR Creation After Approval**
    - **Validates: Requirements 7.5**
  
  - [x] 11.7 Create POST /api/export route
    - Handle PDF, PR link, and Telegram exports
    - Bundle artifacts appropriately
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_
  
  - [x] 11.8 Write property test for export completeness
    - **Property 21: Export Completeness**
    - **Validates: Requirements 9.2, 9.3, 9.4, 9.5**

- [x] 12. Implement frontend components
  - [x] 12.1 Create RepoInputForm component
    - Input field for GitHub URL
    - Validation and error display
    - Submit button triggering OAuth
    - _Requirements: 1.1, 1.2_
  
  - [x] 12.2 Create ProgressBoard component
    - Display agent pipeline with status indicators
    - Highlight active agent
    - Show artifact previews
    - Display approval prompts
    - _Requirements: 8.1, 8.2, 8.3, 8.5, 8.6_
  
  - [x] 12.3 Create DiffViewer component
    - Monaco Editor integration
    - Side-by-side diff display
    - Approve/reject buttons
    - Optional feedback textarea
    - _Requirements: 4.6, 4.7_
  
  - [x] 12.4 Create ArtifactCarousel component
    - Swipeable carousel for artifacts
    - Preview rendering for each artifact type
    - Export buttons
    - QR code display for demo URLs
    - _Requirements: 6.7, 9.1_
  
  - [x] 12.5 Implement SSE client connection
    - Connect to /api/pipeline/stream
    - Handle incoming events and update UI state
    - Handle reconnection on disconnect
    - _Requirements: 8.7_
  
  - [x] 12.6 Write unit tests for frontend components
    - Test component rendering with various props
    - Test user interactions (button clicks, form submission)
    - Test SSE event handling

- [ ] 13. Implement error handling and recovery
  - [ ] 13.1 Create error logging utility
    - Log errors with agent name, message, timestamp
    - Store in Vercel KV for debugging
    - _Requirements: 10.2_
  
  - [ ] 13.2 Write property test for error logging
    - **Property 22: Error Logging**
    - **Validates: Requirements 10.2**
  
  - [ ] 13.3 Implement retry mechanism
    - Add retry button to error displays
    - Resume pipeline from failed step
    - Preserve completed agent results
    - _Requirements: 10.3, 10.5_
  
  - [ ] 13.4 Write property test for pipeline resumption
    - **Property 23: Pipeline Resumption After Retry**
    - **Validates: Requirements 10.5**
  
  - [ ] 13.5 Implement graceful degradation
    - Allow pipeline to continue if optional agents fail (Demo, Pitch)
    - Mark failed agents as skipped
    - _Requirements: 10.6_
  
  - [ ] 13.6 Write unit tests for error scenarios
    - Test authentication failures
    - Test agent timeouts
    - Test API failures with retries
    - _Requirements: 1.4, 5.4, 10.1, 10.4_

- [ ] 14. Implement performance monitoring and timing
  - [ ] 14.1 Add timing instrumentation to agents
    - Record start and end times for each agent
    - Calculate execution duration
    - _Requirements: 12.2, 12.3, 12.4, 12.5_
  
  - [ ] 14.2 Write property test for individual agent timing
    - **Property 29: Individual Agent Timing**
    - **Validates: Requirements 12.2, 12.3, 12.4, 12.5**
  
  - [ ] 14.3 Add end-to-end timing tracking
    - Record pipeline start and completion times
    - Display elapsed time on Progress Board
    - _Requirements: 12.1_
  
  - [ ] 14.4 Write property test for end-to-end execution time
    - **Property 28: End-to-End Execution Time**
    - **Validates: Requirements 12.1**
  
  - [ ] 14.5 Implement timeout notifications
    - Display warning if pipeline exceeds 3 minutes
    - Show per-agent timeout warnings
    - _Requirements: 12.6_

- [ ] 15. Checkpoint - Integration testing
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 16. Implement export functionality
  - [ ] 16.1 Implement PDF export
    - Bundle README, API docs, pitch deck into PDF
    - Use pdf-lib or similar library
    - Return download URL
    - _Requirements: 9.2_
  
  - [ ] 16.2 Implement PR link export
    - Format shareable PR URL
    - Copy to clipboard functionality
    - _Requirements: 9.3_
  
  - [ ] 16.3 Implement Telegram bot integration
    - Set up Telegram bot API client
    - Send artifacts as messages/files
    - Handle chat ID input
    - _Requirements: 9.4_
  
  - [ ] 16.4 Add export success confirmation
    - Display success message after export
    - Show download links or confirmation
    - _Requirements: 9.6_

- [ ] 17. Final integration and polish
  - [ ] 17.1 Wire all components together
    - Connect frontend to API routes
    - Ensure SSE updates trigger UI changes
    - Test full user flow end-to-end
    - _Requirements: All_
  
  - [ ] 17.2 Add loading states and animations
    - Spinner for agent execution
    - Progress animations on Progress Board
    - Smooth transitions between states
    - _Requirements: 8.1, 8.2, 8.3_
  
  - [ ] 17.3 Implement session management
    - Handle session expiration
    - Preserve state across page refreshes
    - Clear expired sessions from KV
    - _Requirements: 1.1, 1.3_
  
  - [ ] 17.4 Write end-to-end integration tests
    - Test complete pipeline with test repository
    - Test approval gate workflows
    - Test error recovery scenarios
    - _Requirements: All_

- [ ] 18. Final checkpoint - Complete system validation
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- All tasks are required for comprehensive implementation
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at key milestones
- Property tests validate universal correctness properties with minimum 100 iterations
- Unit tests validate specific examples and edge cases
- The implementation follows a bottom-up approach: infrastructure → agents → orchestration → frontend → integration
- All property tests must be tagged with format: `// Feature: repoclaw, Property N: [property text]`
- Fast-check library is used for property-based testing in TypeScript
