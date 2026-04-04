import type { Workflow, StepExecution } from '~/types'

function mergeStep(existing: StepExecution | undefined, updates: Partial<StepExecution>): StepExecution {
  return {
    stepId: existing?.stepId ?? updates.stepId ?? '',
    status: updates.status ?? existing?.status ?? 'pending',
    input: updates.input ?? existing?.input ?? '',
    output: updates.output ?? existing?.output ?? '',
    error: updates.error ?? existing?.error,
    startedAt: updates.startedAt ?? existing?.startedAt,
    completedAt: updates.completedAt ?? existing?.completedAt,
  }
}

export function useWorkflowExecution() {
  const steps = ref<StepExecution[]>([])
  const isRunning = ref(false)
  const isPaused = ref(false)
  const currentStepIndex = ref(-1)
  const isComplete = ref(false)
  let abortController: AbortController | null = null
  let _workflow: Workflow | null = null
  let _projectDir: string | undefined
  let _lastOutput = ''

  async function executeStep(stepIndex: number, input: string) {
    if (!_workflow) return
    const step = _workflow.steps[stepIndex]
    if (!step) return

    currentStepIndex.value = stepIndex
    steps.value[stepIndex] = mergeStep(steps.value[stepIndex], { status: 'running', input, startedAt: Date.now() })
    isRunning.value = true
    isPaused.value = false

    abortController = new AbortController()

    try {
      const response = await $fetch<ReadableStream>('/api/chat', {
        method: 'POST',
        body: {
          messages: [{ role: 'user', content: input }],
          agentSlug: step.agentSlug,
          ...(_projectDir ? { projectDir: _projectDir } : {}),
        },
        signal: abortController.signal,
        responseType: 'stream',
      })

      const reader = (response as unknown as ReadableStream).getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let resultText = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const data = JSON.parse(line.slice(6))
            if (data.type === 'text_delta') {
              resultText += data.text
              steps.value[stepIndex] = mergeStep(steps.value[stepIndex], { output: resultText })
            } else if (data.type === 'result') {
              resultText = data.text
              steps.value[stepIndex] = mergeStep(steps.value[stepIndex], { output: resultText })
            } else if (data.type === 'error') {
              throw new Error(data.message)
            }
          } catch (e) {
            if (e instanceof SyntaxError) continue
            throw e
          }
        }
      }

      steps.value[stepIndex] = mergeStep(steps.value[stepIndex], { status: 'completed', output: resultText, completedAt: Date.now() })
      _lastOutput = resultText
      isRunning.value = false

      if (stepIndex < _workflow.steps.length - 1) {
        isPaused.value = true
      } else {
        isPaused.value = false
        isComplete.value = true
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        steps.value[stepIndex] = mergeStep(steps.value[stepIndex], { status: 'failed', error: 'Cancelled', completedAt: Date.now() })
      } else {
        steps.value[stepIndex] = mergeStep(steps.value[stepIndex], { status: 'failed', error: err instanceof Error ? err.message : 'Unknown error', completedAt: Date.now() })
      }
      for (let j = stepIndex + 1; j < _workflow.steps.length; j++) {
        steps.value[j] = mergeStep(steps.value[j], { status: 'skipped' })
      }
      isRunning.value = false
      isPaused.value = false
    }

    abortController = null
  }

  async function run(workflow: Workflow, initialPrompt: string, projectDir?: string) {
    if (isRunning.value) return
    _workflow = workflow
    const { workingDir } = useWorkingDir()
    _projectDir = projectDir || workingDir.value || undefined
    _lastOutput = ''
    isComplete.value = false

    steps.value = workflow.steps.map(s => ({
      stepId: s.id,
      status: 'pending' as const,
      input: '',
      output: '',
    }))

    await executeStep(0, initialPrompt)
  }

  async function continueWorkflow() {
    if (!_workflow || !isPaused.value) return
    const nextIndex = currentStepIndex.value + 1
    if (nextIndex >= _workflow.steps.length) return
    await executeStep(nextIndex, _lastOutput)
  }

  async function continueWith(text: string) {
    if (!_workflow || !isPaused.value) return
    const nextIndex = currentStepIndex.value + 1
    if (nextIndex >= _workflow.steps.length) return
    _lastOutput = text
    await executeStep(nextIndex, text)
  }

  async function respondToStep(reply: string) {
    if (!_workflow || !isPaused.value) return
    const idx = currentStepIndex.value
    const combinedInput = `Previous agent output:\n${_lastOutput}\n\nUser response:\n${reply}`
    steps.value[idx] = mergeStep(steps.value[idx], { status: 'pending', output: '', error: undefined, completedAt: undefined })
    await executeStep(idx, combinedInput)
  }

  function stop() {
    abortController?.abort()
    isRunning.value = false
    isPaused.value = false
    if (_workflow) {
      for (let j = currentStepIndex.value + 1; j < _workflow.steps.length; j++) {
        if (steps.value[j]?.status === 'pending') {
          steps.value[j] = mergeStep(steps.value[j], { status: 'skipped' })
        }
      }
    }
  }

  return {
    steps: readonly(steps),
    isRunning: readonly(isRunning),
    isPaused: readonly(isPaused),
    isComplete: readonly(isComplete),
    currentStepIndex: readonly(currentStepIndex),
    run,
    continueWorkflow,
    continueWith,
    respondToStep,
    stop,
  }
}
