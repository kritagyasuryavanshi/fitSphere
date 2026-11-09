"use client";

import { useState } from "react";
import { Button, Dialog, Tabs } from "@fitsphere/ui";

export function StyleguideTabs() {
  return (
    <Tabs
      label="Weeks"
      tabs={[
        { id: "week-1", label: "Week 1", content: <p className="py-4">Week 1 panel</p> },
        { id: "week-2", label: "Week 2", content: <p className="py-4">Week 2 panel</p> },
        { id: "week-3", label: "Week 3", content: <p className="py-4">Week 3 panel</p> },
      ]}
    />
  );
}

export function StyleguideDialogs() {
  const [open, setOpen] = useState<"plain" | "confirm" | null>(null);
  const close = () => setOpen(null);

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="light" onClick={() => setOpen("plain")}>
        Open dialog
      </Button>
      <Button variant="light" onClick={() => setOpen("confirm")}>
        Open confirm
      </Button>

      <Dialog
        open={open === "plain"}
        onClose={close}
        title="Share this program"
        description="A plain dialog. Focus starts on the first button."
        actions={<Button onClick={close}>Done</Button>}
      />
      <Dialog
        open={open === "confirm"}
        onClose={close}
        alert
        title="Delete your account?"
        description="A destructive confirm. Focus starts on the dialog, not on the delete button."
        actions={
          <>
            <Button variant="danger" onClick={close}>
              Delete my account
            </Button>
            <Button variant="light" onClick={close}>
              Keep my account
            </Button>
          </>
        }
      />
    </div>
  );
}
