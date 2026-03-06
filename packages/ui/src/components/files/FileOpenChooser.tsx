// packages/ui/src/components/files/FileOpenChooser.tsx
import React, { useCallback } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { RiExternalLinkLine, RiFolderOpenLine, RiSideBarLine } from '@remixicon/react';
import { useUIStore } from '@/stores/useUIStore';
import { useFilesViewTabsStore } from '@/stores/useFilesViewTabsStore';
import { openDesktopPath } from '@/lib/desktop'; // Assuming this function exists

interface FileOpenChooserProps {
  filePath: string;
  directory: string;
  children: React.ReactNode;
  onOpenChange?: (open: boolean) => void;
}

type OpenAsOption = 'side-panel' | 'files-tab' | 'external';

const FileOpenChooser: React.FC<FileOpenChooserProps> = ({
  filePath,
  directory,
  children,
  onOpenChange,
}) => {
  const { openContextFile, setActiveMainTab } = useUIStore();
  const { addFileToTab } = useFilesViewTabsStore();
  const [selectedOption, setSelectedOption] = React.useState<OpenAsOption>('side-panel'); // Default option

  const handleOpen = useCallback(() => {
    switch (selectedOption) {
      case 'side-panel':
        openContextFile(directory, filePath);
        break;
      case 'files-tab':
        setActiveMainTab('files');
        addFileToTab(directory, filePath);
        break;
      case 'external':
        openDesktopPath(filePath); // Call the desktop utility
        break;
    }
  }, [selectedOption, openContextFile, directory, filePath, setActiveMainTab, addFileToTab]);

  return (
    <DropdownMenu onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent className="w-56">
        <DropdownMenuRadioGroup value={selectedOption} onValueChange={(value: OpenAsOption) => setSelectedOption(value)}>
          <DropdownMenuRadioItem value="side-panel">
            <RiSideBarLine className="mr-2 h-4 w-4" />
            Open in Side Panel (Default)
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="files-tab">
            <RiFolderOpenLine className="mr-2 h-4 w-4" />
            Open in Files Tab
          </DropdownMenuRadioItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setSelectedOption('external')}>
            <RiExternalLinkLine className="mr-2 h-4 w-4" />
            Open Externally
          </DropdownMenuItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={handleOpen}>
          <Button className="w-full justify-center">Open</Button>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default FileOpenChooser;
