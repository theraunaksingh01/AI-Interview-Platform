// frontend/src/components/RubricBuilder.tsx
"use client"

import React, { useState, useEffect } from "react"
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core"
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { GripVertical, Trash2, ChevronDown, ChevronUp, AlertCircle, Check } from "lucide-react"

interface RubricDimension {
  label: string
  weight: number
  description?: string
}

interface RubricBuilderProps {
  roleId: string | number
  initialRubric?: Record<string, RubricDimension>
  isLocked?: boolean
  onSave: (rubric: Record<string, RubricDimension>) => void
}

const TEMPLATES = {
  software_engineer: {
    dsa: {
      label: "DSA & Problem Solving",
      weight: 30,
      description: "Data structures, algorithms, time/space complexity"
    },
    system_design: {
      label: "System Design",
      weight: 25,
      description: "Scalability, architecture, trade-offs"
    },
    communication: {
      label: "Communication",
      weight: 20,
      description: "Clarity, structure, ability to explain"
    },
    problem_solving: {
      label: "Problem Solving Approach",
      weight: 15,
      description: "How they break down and tackle problems"
    },
    culture_fit: {
      label: "Culture Fit",
      weight: 10,
      description: "Values alignment, collaboration signals"
    }
  },
  product_manager: {
    product_thinking: {
      label: "Product Thinking",
      weight: 35,
      description: "Product vision, user empathy, prioritization"
    },
    analytical: {
      label: "Analytical Reasoning",
      weight: 25,
      description: "Data-driven decision making, metrics understanding"
    },
    communication: {
      label: "Communication",
      weight: 20,
      description: "Storytelling, stakeholder management"
    },
    execution: {
      label: "Execution & Prioritization",
      weight: 20,
      description: "Roadmap planning, shipping speed"
    }
  },
  sales_non_tech: {
    communication: {
      label: "Communication",
      weight: 40,
      description: "Listening, persuasion, presentation"
    },
    domain_knowledge: {
      label: "Domain Knowledge",
      weight: 25,
      description: "Industry expertise, product understanding"
    },
    problem_solving: {
      label: "Problem Solving",
      weight: 20,
      description: "Handling objections, creative solutions"
    },
    culture_fit: {
      label: "Culture Fit",
      weight: 15,
      description: "Team fit, collaboration, adaptability"
    }
  }
}

const DraggableDimension: React.FC<{
  id: string
  dimension: RubricDimension
  index: number
  isLocked: boolean
  onUpdate: (dim: RubricDimension) => void
  onDelete: () => void
  canDelete: boolean
}> = ({ id, dimension, index, isLocked, onUpdate, onDelete, canDelete }) => {
  const [expanded, setExpanded] = useState(false)
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style = { transform: CSS.Transform.toString(transform), transition }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`p-4 border rounded-lg mb-3 bg-white transition-all ${isDragging ? "shadow-lg opacity-50" : "shadow-sm"} ${isLocked ? "bg-gray-50" : ""}`}
    >
      <div className="flex items-center gap-3">
        <button
          {...attributes}
          {...listeners}
          disabled={isLocked}
          className={`text-gray-400 ${isLocked ? "cursor-not-allowed" : "cursor-grab active:cursor-grabbing"}`}
        >
          <GripVertical size={18} />
        </button>

        <div className="flex-1">
          <input
            type="text"
            value={dimension.label}
            onChange={(e) => onUpdate({ ...dimension, label: e.target.value })}
            disabled={isLocked}
            placeholder="Dimension name"
            className="w-full font-semibold text-sm bg-transparent border-b border-gray-200 py-1 disabled:bg-gray-50 disabled:text-gray-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            type="number"
            value={dimension.weight}
            onChange={(e) => onUpdate({ ...dimension, weight: Math.max(1, parseInt(e.target.value) || 0) })}
            disabled={isLocked}
            min="1"
            max="100"
            className="w-16 px-2 py-1 text-sm border rounded bg-white text-center disabled:bg-gray-50 disabled:text-gray-500"
          />
          <span className="text-xs text-gray-500">%</span>
        </div>

        <button
          onClick={() => setExpanded(!expanded)}
          disabled={isLocked}
          className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
        >
          {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>

        <button
          onClick={onDelete}
          disabled={!canDelete || isLocked}
          className="ml-2 text-red-400 hover:text-red-600 disabled:opacity-20"
        >
          <Trash2 size={18} />
        </button>
      </div>

      {expanded && (
        <div className="mt-3 pl-9 border-t pt-3">
          <textarea
            value={dimension.description || ""}
            onChange={(e) => onUpdate({ ...dimension, description: e.target.value })}
            disabled={isLocked}
            placeholder="Optional description/tooltip"
            className="w-full text-sm p-2 border rounded bg-white disabled:bg-gray-50 disabled:text-gray-500"
            rows={2}
          />
        </div>
      )}
    </div>
  )
}

export const RubricBuilder: React.FC<RubricBuilderProps> = ({
  roleId,
  initialRubric,
  isLocked = false,
  onSave
}) => {
  const [rubric, setRubric] = useState<Record<string, RubricDimension>>(initialRubric || {})
  const [dimensionKeys, setDimensionKeys] = useState<string[]>(Object.keys(initialRubric || {}))
  const [error, setError] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { distance: 8 }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const totalWeight = Object.values(rubric).reduce((sum, dim) => sum + dim.weight, 0)
  const isValid = dimensionKeys.length >= 2 && dimensionKeys.length <= 8 && totalWeight === 100

  const handleAddDimension = () => {
    const newKey = `dimension_${Date.now()}`
    const newDim: RubricDimension = { label: "", weight: 0, description: "" }
    setRubric({ ...rubric, [newKey]: newDim })
    setDimensionKeys([...dimensionKeys, newKey])
  }

  const handleUpdateDimension = (key: string, updated: RubricDimension) => {
    setRubric({ ...rubric, [key]: updated })
  }

  const handleDeleteDimension = (key: string) => {
    if (dimensionKeys.length > 2) {
      const { [key]: _, ...rest } = rubric
      setRubric(rest)
      setDimensionKeys(dimensionKeys.filter((k) => k !== key))
    }
  }

  const handleApplyTemplate = (templateKey: keyof typeof TEMPLATES) => {
    const template = TEMPLATES[templateKey]
    setRubric(template)
    setDimensionKeys(Object.keys(template))
    setError(null)
  }

  const handleDragEnd = (event: any) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      const oldIndex = dimensionKeys.indexOf(active.id)
      const newIndex = dimensionKeys.indexOf(over.id)
      setDimensionKeys(arrayMove(dimensionKeys, oldIndex, newIndex))
    }
  }

  const handleSave = () => {
    if (!isValid) {
      setError(validateRubric())
      return
    }
    onSave(rubric)
  }

  const validateRubric = (): string => {
    if (dimensionKeys.length < 2) return "Add at least 2 dimensions"
    if (dimensionKeys.length > 8) return "Maximum 8 dimensions allowed"
    for (const key of dimensionKeys) {
      if (!rubric[key].label.trim()) return "All dimensions need a label"
      if (rubric[key].weight < 1) return "Each dimension needs at least 1%"
    }
    if (totalWeight !== 100) return `Weights total ${totalWeight}% — must be exactly 100%`
    return ""
  }

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-xl">
      <h2 className="text-2xl font-bold mb-2">Scoring Rubric</h2>
      <p className="text-gray-600 mb-6">Define weighted dimensions to score candidates on this role.</p>

      {isLocked && (
        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-800 font-semibold">🔒 Locked: Interviews have been conducted</p>
          <p className="text-xs text-yellow-700 mt-1">
            To use a different rubric, duplicate this role with a new rubric.
          </p>
        </div>
      )}

      {/* Templates */}
      <div className="mb-6">
        <p className="text-sm font-semibold text-gray-700 mb-3">Start with a template:</p>
        <div className="flex gap-2 flex-wrap">
          {[
            ["software_engineer", "Software Engineer"],
            ["product_manager", "Product Manager"],
            ["sales_non_tech", "Sales/Non-Tech"]
          ].map(([key, label]) => (
            <button
              key={key}
              onClick={() => handleApplyTemplate(key as keyof typeof TEMPLATES)}
              disabled={isLocked}
              className={`px-4 py-2 text-sm rounded border transition-all ${
                isLocked
                  ? "opacity-50 cursor-not-allowed"
                  : "hover:bg-blue-50 border-blue-300 text-blue-700 hover:border-blue-500"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Dimensions list */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={dimensionKeys} strategy={verticalListSortingStrategy}>
          <div className="mb-6">
            {dimensionKeys.map((key) => (
              <DraggableDimension
                key={key}
                id={key}
                dimension={rubric[key]}
                index={dimensionKeys.indexOf(key)}
                isLocked={isLocked}
                onUpdate={(updated) => handleUpdateDimension(key, updated)}
                onDelete={() => handleDeleteDimension(key)}
                canDelete={dimensionKeys.length > 2}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {/* Add dimension button */}
      <button
        onClick={handleAddDimension}
        disabled={isLocked || dimensionKeys.length >= 8}
        className={`w-full py-2 text-sm border-2 border-dashed rounded transition-all ${
          isLocked || dimensionKeys.length >= 8
            ? "opacity-50 cursor-not-allowed border-gray-200 text-gray-400"
            : "border-blue-300 text-blue-600 hover:bg-blue-50"
        }`}
      >
        + Add Dimension
      </button>

      {/* Weight summary */}
      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-700">Total Weight:</span>
          <span
            className={`text-lg font-bold ${
              totalWeight === 100 ? "text-green-600" : "text-red-600"
            }`}
          >
            {totalWeight}%
          </span>
        </div>

        {error && (
          <div className="mt-3 flex items-start gap-2 text-sm text-red-700 bg-red-50 p-3 rounded">
            <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {totalWeight === 100 && dimensionKeys.length >= 2 && (
          <div className="mt-3 flex items-center gap-2 text-sm text-green-700 bg-green-50 p-3 rounded">
            <Check size={16} />
            <span>Ready to save</span>
          </div>
        )}
      </div>

      {/* Save button */}
      <button
        onClick={handleSave}
        disabled={!isValid || isLocked}
        className={`w-full mt-6 py-3 font-semibold rounded-lg transition-all ${
          isValid && !isLocked
            ? "bg-blue-600 text-white hover:bg-blue-700"
            : "bg-gray-200 text-gray-400 cursor-not-allowed"
        }`}
      >
        Save Rubric
      </button>
    </div>
  )
}
