"use client"

import { useEffect, useRef } from "react"
import Script from "next/script"

interface PdfViewerProps {
    url: string
    highlightText?: string
}

declare global {
    interface Window {
        AdobeDC: any
    }
}

export function PdfViewer({ url, highlightText }: PdfViewerProps) {
    const divRef = useRef<HTMLDivElement>(null)
    const viewerRef = useRef<any>(null)

    useEffect(() => {
        const initPDF = () => {
            if (!window.AdobeDC || !divRef.current) return

            const clientId = process.env.NEXT_PUBLIC_ADOBE_CLIENT_ID
            if (!clientId) {
                console.warn("Adobe Client ID is missing. Please set NEXT_PUBLIC_ADOBE_CLIENT_ID in .env.local")
                return
            }

            // 既存のビューワーがあれば破棄するか、再利用するロジックが必要だが
            // Adobe Embed APIは同じDIVへの再マウントに弱いため、IDを一意にする等の工夫が必要
            // ここではシンプルに実装し、アンマウント時のクリーンアップはAPIの仕様による

            const adobeDCView = new window.AdobeDC.View({
                clientId: clientId,
                divId: "adobe-pdf-viewer",
            })

            const previewConfig = {
                enableSearchAPIs: true,
                embedMode: "SIZED_CONTAINER",
                showAnnotationTools: false,
                showDownloadPDF: false,
                showPrintPDF: false,
            }

            const previewPromise = adobeDCView.previewFile(
                {
                    content: { location: { url: url } },
                    metaData: { fileName: "Document.pdf" },
                },
                previewConfig
            )

            previewPromise.then((adobeViewer: any) => {
                viewerRef.current = adobeViewer

                if (highlightText) {
                    adobeViewer.getAPIs().then((apis: any) => {
                        const searchApis = apis.getSearchAPIs()
                        searchApis.search(highlightText)
                            .then((res: any) => {
                                console.log("Search result:", res)
                            })
                            .catch((err: any) => {
                                console.error("Search error:", err)
                            })
                    })
                }
            })
        }

        if (window.AdobeDC) {
            initPDF()
        } else {
            document.addEventListener("adobe_dc_view_sdk.ready", initPDF)
        }

        return () => {
            document.removeEventListener("adobe_dc_view_sdk.ready", initPDF)
        }
    }, [url, highlightText])

    return (
        <>
            <Script
                src="https://documentcloud.adobe.com/view-sdk/main.js"
                strategy="lazyOnload"
            />
            <div id="adobe-pdf-viewer" ref={divRef} className="h-full w-full" />
        </>
    )
}
