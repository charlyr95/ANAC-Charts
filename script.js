  // Set up viewing mode based on user preference
  function rotatePdfPages() {
    const viewer = document.getElementById("pdf-viewer");
    if (!viewer) {
      console.warn("No se encontró el elemento con id 'pdf-viewer'");
      return;
    }

    console.log(viewer);
    console.log(viewer.firstElementChild);
    return;
    const roleDocument = viewer.querySelector('[role="document"]');
    if (!roleDocument) {
      console.warn("No se encontró el elemento con role='document'");
      return;
    }
  
    currentRotation = (currentRotation + 90) % 360;
  
    const pages = roleDocument.children;
  
    for (const page of pages) {
      page.style.transform = `rotate(${currentRotation}deg)`;
      page.style.transformOrigin = 'center center';
    }
  }

document.addEventListener("DOMContentLoaded", () => {
  // Elements
  const searchInput = document.getElementById("airport-search")
  const searchBtn = document.getElementById("search-btn")
  const chartTypeButtons = document.querySelectorAll(".chart-type-btn")
  const resultsList = document.getElementById("results-list")
  const pdfViewer = document.getElementById("pdf-viewer")
  const noPdfMessage = document.getElementById("no-pdf-message")
  const pdfLoading = document.getElementById("pdf-loading")
  const pdfCanvasContainer = document.getElementById("pdf-canvas-container")
  const loadingIndicator = document.getElementById("loading-indicator")
  const externalLinks = document.getElementById("external-links")
  const openNewTab = document.getElementById("open-new-tab")
  const downloadPdf = document.getElementById("download-pdf")

  // Current state
  let airportsData = {}
  let currentAirport = null
  let currentChartType = "STAR" // Default chart type
  let currentPdfUrl = null
  let currentPdfTitle = null
  let viewingMode = "direct" // Default viewing mode
  let currentRotation = 0; // Default pdf rotation

  // Show PDF loading indicator
  function showPdfLoading() {
    pdfLoading.classList.remove("hidden")
  }

  // Hide PDF loading indicator
  function hidePdfLoading() {
    pdfLoading.classList.add("hidden")
  }

  
  // Fetch and parse airport data from ANAC website with exact headers
  async function fetchAirportData(useProxy = false) {

    try {
      const url = "https://ais.anac.gov.ar/aip/ad"

      // Try direct fetch with the exact headers provided
      const response = await fetch("database.html", {
        method: "GET",
        headers: {
          'accept': 'text/html',
        },
        credentials: "include" // This will include cookies automatically
      })
      

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`)
      }

      const html = await response.text()
      parseAirportData(html)
      resultsList.innerHTML = `
      <p class="text-green-500">Datos cargados correctamente. Busque un aeropuerto.</p>
      <p class="text-red-500">No válido para navegación real. Utilizado en entornos de simulación únicamente.</p>
      `

      // Hide CORS warning if successful
    } catch (error) {
      console.error("Error fetching airport data:", error)
      resultsList.innerHTML = `
      <p class="text-red-500">Error al cargar datos: ${error.message}</p>
      <p class="text-gray-500 text-sm mt-2">Intente usar el proxy CORS o cargar los datos de ejemplo.</p>
      `
    } 
  }

  // Improved parsing function with better airport code detection
  function parseAirportData(html) {
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, "text/html")
    const tableRows = doc.querySelectorAll("#datatable tbody tr")

    // Initialize the airports data structure
    airportsData = {}

    tableRows.forEach((row) => {
      const titleCell = row.querySelector("td.col-xs-9")
      const linkCell = row.querySelector("td.col-xs-3.text-right a")
      
      if (!titleCell || !linkCell) return
      
      const title = titleCell.textContent.trim()
      const titulo = title.toUpperCase()
      const url = linkCell.getAttribute("href")
      // Ensure the URL is properly formatted
      let fullUrl
      if (url.startsWith("http")) {
        fullUrl = url
      } else if (url.startsWith("/")) {
        fullUrl = `https://ais.anac.gov.ar${url}`
      } else {
        fullUrl = `https://ais.anac.gov.ar/${url}`
      }
      // console.log("Chart URL:", fullUrl)

      // Extract airport code - looking for patterns like SAXX in the title
      // Improved regex to better match airport codes
      const airportCodeMatch = titulo.match(/\b(S[A-Z]{3})\b/)

      // If no direct airport code is found, try to extract from the title context
      let airportCode = null
      if (airportCodeMatch) {
        airportCode = airportCodeMatch[1]
      } else if (titulo.includes("Aeropuerto") || titulo.includes("Aeródromo")) {
        // Try to find a code in format SA followed by 2 letters
        const secondaryMatch = titulo.match(/\b(S[A-Z]{2}[A-Z])\b/)
        if (secondaryMatch) {
          airportCode = secondaryMatch[1]
        }
      }

      if (!airportCode) {
        // If we still can't find an airport code, skip this entry
        return
      }

      // Determine chart type based on keywords in the title
      let chartType = "REF" // Default to REF


      if (titulo.includes("STAR") || titulo.includes("LLEGADA") || titulo.includes("ARRIVAL")) {
        chartType = "STAR"
      } else if (
        titulo.includes("APP") ||
        titulo.includes("APROXIMACIÓN") ||
        titulo.includes("APPROACH") ||
        titulo.includes("ILS") ||
        titulo.includes("VOR") ||
        titulo.includes("NDB")
      ) {
        chartType = "APP"
      } else if (
        titulo.includes("TAXI") ||
        titulo.includes("RODAJE") ||
        titulo.includes("GROUND") ||
        titulo.includes("PLATAFORMA") ||
        titulo.includes("PLANO DE AER")
      ) {
        chartType = "TAXI"
      } else if (titulo.includes("SID") || titulo.includes("SALIDA") || titulo.includes("DEPARTURE")) {
        chartType = "SID"
      }

      // Initialize airport data if it doesn't exist
      if (!airportsData[airportCode]) {
        airportsData[airportCode] = {
          name: extractAirportName(title, airportCode),
          charts: {
            STAR: [],
            APP: [],
            TAXI: [],
            SID: [],
            REF: [],
          },
        }
      }

      // Add chart to the appropriate category
      airportsData[airportCode].charts[chartType].push({
        title: title,
        url: fullUrl,
      })
    })

    // Update the UI to show how many airports were found
    const airportCount = Object.keys(airportsData).length
    if (airportCount > 0) {
      resultsList.innerHTML = `
        <p class="text-green-500">Se encontraron ${airportCount} aeropuertos.</p>
        <p class="text-sm text-gray-200">Busque por código OACI (ej: SABE, SAME)</p>
      `
    } else {
      resultsList.innerHTML = `
        <p class="text-yellow-500">No se encontraron aeropuertos en los datos.</p>
      `
    }
  }

  // Helper function to extract airport name from title
  function extractAirportName(title, code) {
    // Try to find "Aeropuerto" or "Aeródromo" followed by a name
    const nameMatch = title.match(/(?:Aeropuerto|Aeródromo)\s+(.+?)(?:\s+-|\s+\/|\s+\(|$)/)
    if (nameMatch) {
      return nameMatch[1].trim()
    }

    // If no name found, use a generic name with the code
    return `Aeropuerto ${code}`
  }

  // Set active chart type
  function setActiveChartType(type) {
    chartTypeButtons.forEach((btn) => {
      if (btn.dataset.type === type) {
        btn.classList.remove("bg-gray-400")
        btn.classList.add("bg-blue-500", "text-white")
      } else {
        btn.classList.remove("bg-blue-500", "text-white")
        btn.classList.add("bg-gray-400")
      }
    })
    currentChartType = type
    if (currentAirport) {
      displayChartList(currentAirport, type)
    }
  }

  // Display chart list for an airport and chart type
  function displayChartList(airportCode, chartType) {
    resultsList.innerHTML = ""

    const airport = airportsData[airportCode.toUpperCase()]
    if (!airport) {
      resultsList.innerHTML = '<p class="text-red-500">Aeropuerto no encontrado</p>'
      return
    }

    // Airport header
    const airportHeader = document.createElement("div")
    airportHeader.className = "p-2 rounded-md mb-2"
    airportHeader.innerHTML = `
      <h3 class="font-bold">${airportCode.toUpperCase()}</h3>
      <p class="text-sm text-gray-300">${airport.name}</p>
    `
    resultsList.appendChild(airportHeader)

    // Charts list
    const charts = airport.charts[chartType] || []
    if (charts.length === 0) {
      const noCharts = document.createElement("p")
      noCharts.className = "text-gray-500 italic text-sm"
      noCharts.textContent = `No hay cartas ${chartType} disponibles`
      resultsList.appendChild(noCharts)
      return
    }

    charts.forEach((chart) => {
      const chartItem = document.createElement("div")
      chartItem.className = "border border-solid border-gray-600 p-2 rounded-md cursor-pointer"
      chartItem.innerHTML = `
        <p class="text-blue-400">${chart.title}</p>
      `
      chartItem.addEventListener("click", () => {
        displayPdf(chart.title, chart.url)
      })
      resultsList.appendChild(chartItem)
    })
  }

  // Display PDF in the viewer using different methods based on the viewing mode
  function displayPdf(title, url) {
    showPdfLoading()

    // Store current PDF info
    currentPdfUrl = url
    currentPdfTitle = title

    // Update external links
    openNewTab.href = url
    downloadPdf.href = url
    externalLinks.classList.remove("hidden")

    // Make sure the message is hidden
    noPdfMessage.classList.add("hidden")

    // Reset all viewers
    pdfViewer.classList.add("hidden")
    pdfCanvasContainer.classList.add("hidden")
    pdfCanvasContainer.innerHTML = ""

    // Format URL if needed
    let pdfUrl = url
    if (!pdfUrl.startsWith("http")) {
      pdfUrl = `https://ais.anac.gov.ar${pdfUrl}`
    }

    displayGoogleViewer(pdfUrl)
  }

  // Display PDF using Google Docs Viewer
  function displayGoogleViewer(url) {
    const googleViewerUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`

    

    pdfViewer.onload = () => {
      // console.log("PDF loaded successfully (Google Viewer)")
      hidePdfLoading()
    }

    pdfViewer.onerror = () => {
      console.error("Error loading PDF via Google Viewer")
      hidePdfLoading()

      // Show error message
      noPdfMessage.classList.remove("hidden")
      noPdfMessage.innerHTML = `
        <i class="fas fa-exclamation-triangle text-red-500 text-6xl mb-4"></i>
        <p class="text-red-500">No se pudo cargar el PDF con ningún método.</p>
        <p class="text-gray-200 mt-2">Por favor, utilice los enlaces externos en el panel lateral.</p>
      `
    }

    // Set iframe source with Google Viewer
    // pdfViewer.src = googleViewerUrl
    pdfViewer.src = url;
    pdfViewer.classList.remove("hidden")
  }

  // Search for an airport
  function searchAirport() {
    const query = searchInput.value.trim().toUpperCase()
    if (query === "") return

    if (airportsData[query]) {
      currentAirport = query
      displayChartList(query, currentChartType)
    } else {
      // Try to find partial matches
      const matches = Object.keys(airportsData).filter(
        (code) => code.includes(query) || airportsData[code].name.toUpperCase().includes(query),
      )

      if (matches.length > 0) {
        // Show matches
        resultsList.innerHTML = `
          <p class="text-blue-300">Se encontraron ${matches.length} aeropuertos similares:</p>
        `

        matches.forEach((code) => {
          const matchItem = document.createElement("div")
          matchItem.className = "p-2 rounded-md cursor-pointer"
          matchItem.innerHTML = `
            <p class="font-medium">${code}</p>
            <p class="text-sm text-gray-400">${airportsData[code].name}</p>
          `
          matchItem.addEventListener("click", () => {
            currentAirport = code
            searchInput.value = code
            displayChartList(code, currentChartType)
          })
          resultsList.appendChild(matchItem)
        })
      } else {
        resultsList.innerHTML = '<p class="text-red-500">Aeropuerto no encontrado</p>'
        currentAirport = null
      }
    }
  }

  // Event listeners
  searchBtn.addEventListener("click", searchAirport)
  searchInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") searchAirport()
  })

  chartTypeButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      setActiveChartType(btn.dataset.type)
    })
  })

  // Initialize with default chart type
  setActiveChartType("STAR")

  // Fetch airport data when the page loads
  fetchAirportData()
})
