-- ============================================================================
-- OpenSpace Helper Functions for NASA Open MCT Bridge
-- ============================================================================
-- These Lua helper functions can be added to OpenSpace's startup scripts
-- or executed via the WebSocket JSON bridge.
-- ============================================================================

-- Safely focus and anchor camera on any celestial body or spacecraft
function focusTarget(targetName)
    openspace.printInfo("Open MCT commanding camera to target: " .. targetName)
    openspace.setPropertyValueSingle("NavigationHandler.OrbitalNavigator.Anchor", targetName)
    openspace.setPropertyValueSingle("NavigationHandler.OrbitalNavigator.Aim", "")
    openspace.navigation.retargetAnchor()
end

-- Synchronize simulation time from ISO-8601 string
function syncMissionTime(isoTimeString)
    openspace.time.setTime(isoTimeString)
end

-- Pause or unpause OpenSpace time simulation
function setSimulationPaused(isPaused)
    openspace.time.setPause(isPaused)
end

-- Trigger thruster visual effect
function setThrusterPlume(active)
    if openspace.hasProperty("Scene.Gateway.Renderable.ShowThrust") then
        openspace.setPropertyValueSingle("Scene.Gateway.Renderable.ShowThrust", active)
    end
end

-- Focus Earth / Moon directly
function focusEarth()
    focusTarget("Earth")
end

function focusMoon()
    focusTarget("Moon")
end

-- Update spacecraft or satellite position marker in OpenSpace
function updateSatellitePosition(satId, lat, lon, altKm)
    local nodeName = "Scene." .. satId
    if openspace.hasProperty(nodeName .. ".Translation.Latitude") then
        openspace.setPropertyValueSingle(nodeName .. ".Translation.Latitude", lat)
        openspace.setPropertyValueSingle(nodeName .. ".Translation.Longitude", lon)
        openspace.setPropertyValueSingle(nodeName .. ".Translation.Altitude", altKm * 1000.0)
    end
end

