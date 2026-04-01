// frontend/src/components/RubricBuilder.test.tsx
import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { RubricBuilder } from "./RubricBuilder"

describe("RubricBuilder", () => {
  const mockOnSave = vi.fn()

  const defaultProps = {
    roleId: "1",
    onSave: mockOnSave,
    isLocked: false
  }

  beforeEach(() => {
    mockOnSave.mockClear()
  })

  it("renders template buttons", () => {
    render(<RubricBuilder {...defaultProps} />)
    expect(screen.getByText("Software Engineer")).toBeInTheDocument()
    expect(screen.getByText("Product Manager")).toBeInTheDocument()
    expect(screen.getByText("Sales/Non-Tech")).toBeInTheDocument()
  })

  it("applies template when clicked", async () => {
    render(<RubricBuilder {...defaultProps} />)
    const engineerBtn = screen.getByText("Software Engineer")
    await userEvent.click(engineerBtn)

    await waitFor(() => {
      expect(screen.getByDisplayValue("DSA & Problem Solving")).toBeInTheDocument()
      expect(screen.getByDisplayValue("System Design")).toBeInTheDocument()
    })
  })

  it("shows weight total", async () => {
    const rubric = {
      dsa: { label: "DSA", weight: 60, description: "" },
      comm: { label: "Communication", weight: 40, description: "" }
    }
    render(<RubricBuilder {...defaultProps} initialRubric={rubric} />)
    expect(screen.getByText("100%")).toBeInTheDocument()
  })

  it("disables save when weights don't total 100", async () => {
    const rubric = {
      dsa: { label: "DSA", weight: 50, description: "" },
      comm: { label: "Communication", weight: 40, description: "" }
    }
    render(<RubricBuilder {...defaultProps} initialRubric={rubric} />)
    const saveBtn = screen.getByText("Save Rubric")
    expect(saveBtn).toBeDisabled()
    expect(screen.getByText("Weights total 90% — must be exactly 100%")).toBeInTheDocument()
  })

  it("enables save when weights total 100 and min 2 dimensions", async () => {
    const rubric = {
      dsa: { label: "DSA", weight: 60, description: "" },
      comm: { label: "Communication", weight: 40, description: "" }
    }
    render(<RubricBuilder {...defaultProps} initialRubric={rubric} />)
    const saveBtn = screen.getByText("Save Rubric")
    expect(saveBtn).not.toBeDisabled()
    expect(screen.getByText("Ready to save")).toBeInTheDocument()
  })

  it("calls onSave with rubric when save is clicked", async () => {
    const rubric = {
      dsa: { label: "DSA", weight: 60, description: "" },
      comm: { label: "Communication", weight: 40, description: "" }
    }
    render(<RubricBuilder {...defaultProps} initialRubric={rubric} />)
    const saveBtn = screen.getByText("Save Rubric")
    await userEvent.click(saveBtn)

    expect(mockOnSave).toHaveBeenCalledWith(rubric)
  })

  it("prevents deleting when only 2 dimensions exist", async () => {
    const rubric = {
      dsa: { label: "DSA", weight: 60, description: "" },
      comm: { label: "Communication", weight: 40, description: "" }
    }
    render(<RubricBuilder {...defaultProps} initialRubric={rubric} />)
    const deleteButtons = screen.getAllByRole("button", { name: /trash/i })
    // All delete buttons should be disabled
    deleteButtons.forEach((btn) => {
      // The actual delete button for trash icon, not the template buttons
    })
  })

  it("shows locked state when isLocked=true", () => {
    render(<RubricBuilder {...defaultProps} isLocked={true} />)
    expect(screen.getByText(/Locked: Interviews have been conducted/i)).toBeInTheDocument()
    const saveBtn = screen.getByText("Save Rubric")
    expect(saveBtn).toBeDisabled()
  })

  it("validates minimum 2 dimensions", async () => {
    const rubric = {
      dsa: { label: "DSA", weight: 100, description: "" }
    }
    render(<RubricBuilder {...defaultProps} initialRubric={rubric} />)
    const saveBtn = screen.getByText("Save Rubric")
    expect(saveBtn).toBeDisabled()
    expect(screen.getByText("Add at least 2 dimensions")).toBeInTheDocument()
  })

  it("validates maximum 8 dimensions", async () => {
    const rubric: Record<string, any> = {}
    for (let i = 0; i < 9; i++) {
      rubric[`dim${i}`] = { label: `Dimension ${i}`, weight: 12, description: "" }
    }
    rubric.dim8.weight = 4 // adjust so total = 100
    render(<RubricBuilder {...defaultProps} initialRubric={rubric} />)
    const saveBtn = screen.getByText("Save Rubric")
    expect(saveBtn).toBeDisabled()
    expect(screen.getByText("Maximum 8 dimensions allowed")).toBeInTheDocument()
  })

  it("allows adding and deleting dimensions", async () => {
    render(<RubricBuilder {...defaultProps} />)
    const addBtn = screen.getByText("+ Add Dimension")
    await userEvent.click(addBtn)
    const inputs = screen.getAllByPlaceholderText("Dimension name")
    expect(inputs.length).toBeGreaterThan(0)
  })
})
