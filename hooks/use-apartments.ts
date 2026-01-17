"use client"

import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase"
import type { Apartment } from "@/lib/database.types"

export function useApartments() {
  const [apartments, setApartments] = useState<Apartment[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  // マンション一覧を取得
  const fetchApartments = useCallback(async () => {
    setLoading(true)
    
    const { data, error } = await supabase
      .from("apartments")
      .select("*")
      .order("name", { ascending: true })

    if (!error && data) {
      setApartments(data)
    }
    
    setLoading(false)
  }, [supabase])

  // 初回ロード時に取得
  useEffect(() => {
    fetchApartments()
  }, [fetchApartments])

  return {
    apartments,
    loading,
    fetchApartments,
  }
}
