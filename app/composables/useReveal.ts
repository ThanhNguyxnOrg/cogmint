export function useReveal() {
  const toast = useToast()

  async function reveal(path: string) {
    if (!path) return
    try {
      await $fetch('/api/reveal', {
        method: 'POST',
        body: { path }
      })
    } catch (err: any) {
      console.error('Failed to reveal in finder:', err)
      toast.add({
        title: 'Failed to open directory',
        description: err.data?.message || err.message,
        color: 'error'
      })
    }
  }

  return { reveal }
}
