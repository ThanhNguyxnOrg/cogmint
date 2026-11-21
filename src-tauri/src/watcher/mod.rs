use crate::error::{AppError, AppResult};
use notify::{Event, RecommendedWatcher, RecursiveMode, Watcher};
use std::collections::HashMap;
use std::path::Path;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

const DEBOUNCE_MS: u64 = 250;

#[derive(Default)]
pub struct WorkspaceWatcher {
    watchers: Arc<Mutex<HashMap<String, RecommendedWatcher>>>,
}

impl WorkspaceWatcher {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn watch<F>(&self, workspace_id: &str, path: &Path, on_dirty: F) -> AppResult<()>
    where
        F: Fn(String) + Send + Sync + 'static,
    {
        self.unwatch(workspace_id);

        let ws_id = workspace_id.to_string();
        let last_emit = Arc::new(Mutex::new(Instant::now() - Duration::from_secs(10)));
        let callback = Arc::new(on_dirty);

        let mut watcher = notify::recommended_watcher(move |res: notify::Result<Event>| {
            let Ok(event) = res else { return };
            if event.paths.iter().all(|p| should_ignore_path(p)) {
                return;
            }
            if let Ok(mut last) = last_emit.lock() {
                if last.elapsed() >= Duration::from_millis(DEBOUNCE_MS) {
                    *last = Instant::now();
                    callback(ws_id.clone());
                }
            }
        })
        .map_err(|e| AppError::External(format!("Failed to create FS watcher: {e}")))?;

        watcher
            .watch(path, RecursiveMode::Recursive)
            .map_err(|e| AppError::External(format!("Failed to watch '{}': {e}", path.display())))?;

        let mut map = self
            .watchers
            .lock()
            .map_err(|e| AppError::External(format!("Watcher mutex poisoned: {e}")))?;
        map.insert(workspace_id.to_string(), watcher);
        Ok(())
    }

    pub fn unwatch(&self, workspace_id: &str) {
        if let Ok(mut map) = self.watchers.lock() {
            if let Some(watcher) = map.remove(workspace_id) {
                drop(watcher);
            }
        }
    }
}

fn should_ignore_path(path: &Path) -> bool {
    path.components().any(|c| {
        let s = c.as_os_str().to_string_lossy();
        matches!(s.as_ref(), ".git" | "node_modules" | "target" | "dist" | ".superpowers")
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_watcher_drops_handle_on_unwatch_allowing_directory_removal() {
        let parent = tempfile::tempdir().unwrap();
        let target = parent.path().join("watched-wt");
        std::fs::create_dir_all(&target).unwrap();

        let watcher = WorkspaceWatcher::new();
        watcher.watch("ws-1", &target, |_| {}).unwrap();
        watcher.unwatch("ws-1");

        // On Windows, an active directory watch handle blocks remove_dir_all
        std::fs::remove_dir_all(&target).unwrap();
        assert!(!target.exists());
    }
}
