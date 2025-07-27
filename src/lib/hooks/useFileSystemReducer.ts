import { useReducer, useCallback } from 'react';

interface FileSystemState {
  selectedFile: string | null;
  refreshTrigger: number;
}

type FileSystemAction = 
  | { type: 'SELECT_FILE'; payload: string | null }
  | { type: 'TRIGGER_REFRESH' }
  | { type: 'RESET' };

function fileSystemReducer(state: FileSystemState, action: FileSystemAction): FileSystemState {
  switch (action.type) {
    case 'SELECT_FILE':
      return {
        ...state,
        selectedFile: action.payload,
      };
    case 'TRIGGER_REFRESH':
      return {
        ...state,
        refreshTrigger: state.refreshTrigger + 1,
      };
    case 'RESET':
      return {
        selectedFile: null,
        refreshTrigger: 0,
      };
    default:
      return state;
  }
}

const initialState: FileSystemState = {
  selectedFile: null,
  refreshTrigger: 0,
};

export function useFileSystemReducer() {
  const [state, dispatch] = useReducer(fileSystemReducer, initialState);

  const setSelectedFile = useCallback((path: string | null) => {
    dispatch({ type: 'SELECT_FILE', payload: path });
  }, []);

  const triggerRefresh = useCallback(() => {
    dispatch({ type: 'TRIGGER_REFRESH' });
  }, []);

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);

  return {
    ...state,
    setSelectedFile,
    triggerRefresh,
    reset,
  };
}