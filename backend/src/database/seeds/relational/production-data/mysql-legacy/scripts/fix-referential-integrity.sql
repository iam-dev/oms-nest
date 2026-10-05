-- =============================================================================
-- REFERENTIAL INTEGRITY FIX SCRIPT
-- =============================================================================
-- This script fixes known referential integrity issues in the legacy data
--
-- Fixed:
-- 1. FactoryEmployees: FactoryID uses UserID instead of Factory.ID
--
-- Reported only, NOT changed (the rows must stay as they are in production):
-- 2. Orders: 16 references to deleted fitters (29, 46, 76, 89)
-- 3. Customers: 3 references to the same deleted fitters
-- 4. Orders with FactoryID=0 (unassigned orders)
--
-- Until 2026-10-05 this script also set the fitter of those orders and customers
-- to 0. That contradicted the documented decision to preserve them and would have
-- changed production data in every file generated afterwards, so FIX 2 and FIX 3
-- no longer update anything.
--
-- Usage:
--   mysql -u oms_user -p oms_legacy < fix-referential-integrity.sql
-- =============================================================================

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET FOREIGN_KEY_CHECKS = 0;

-- =============================================================================
-- FIX 1: FactoryEmployees - Correct FactoryID values
-- =============================================================================
-- The FactoryEmployees table incorrectly uses Credentials.UserID instead of Factory.ID
-- adam: UserID=21 corresponds to Factory.ID=3 (where Factory.UserID=21)
-- gary: UserID=22 corresponds to Factory.ID=4 (where Factory.UserID=22)

SELECT '=== FIX 1: FactoryEmployees ===' AS Status;

-- Show before state
SELECT 'Before fix:' AS Status;
SELECT fe.ID, fe.Name, fe.FactoryID as 'Current_FactoryID',
       f.ID as 'Correct_FactoryID', f.Emailaddress
FROM FactoryEmployees fe
LEFT JOIN Factories f ON f.UserID = fe.FactoryID;

-- Apply fix: Update FactoryID to use correct Factory.ID
UPDATE FactoryEmployees fe
JOIN Factories f ON f.UserID = fe.FactoryID
SET fe.FactoryID = f.ID;

-- Show after state
SELECT 'After fix:' AS Status;
SELECT fe.ID, fe.Name, fe.FactoryID, f.City, f.Emailaddress
FROM FactoryEmployees fe
JOIN Factories f ON fe.FactoryID = f.ID;

-- =============================================================================
-- FIX 2: Orders with non-existent FitterID
-- =============================================================================
-- Some orders reference fitters that were deleted from the system.
-- Preserved as in production: reported, not changed.

SELECT '=== FIX 2: Orders with deleted fitters (report only) ===' AS Status;

SELECT 'Orders with non-existent fitters:' AS Status;
SELECT o.FitterID, COUNT(*) as order_count
FROM Orders o
LEFT JOIN Fitters f ON o.FitterID = f.ID
WHERE o.FitterID > 0 AND f.ID IS NULL
GROUP BY o.FitterID;


-- =============================================================================
-- FIX 3: Customers with non-existent FitterID
-- =============================================================================
-- Some customers reference fitters that were deleted.
-- Preserved as in production: reported, not changed.

SELECT '=== FIX 3: Customers with deleted fitters (report only) ===' AS Status;

SELECT 'Customers with non-existent fitters:' AS Status;
SELECT c.FitterID, COUNT(*) as customer_count
FROM Customers c
LEFT JOIN Fitters f ON c.FitterID = f.ID
WHERE c.FitterID > 0 AND f.ID IS NULL
GROUP BY c.FitterID;


-- =============================================================================
-- NOTE: Orders with FactoryID=0
-- =============================================================================
-- Orders with FactoryID=0 are intentional (unassigned/historical orders)
-- These are NOT fixed as they represent valid business data

SELECT '=== NOTE: Orders with FactoryID=0 ===' AS Status;
SELECT 'These orders are intentionally unassigned (historical data):' AS Note;
SELECT COUNT(*) as unassigned_orders FROM Orders WHERE FactoryID = 0;

-- =============================================================================
-- VERIFICATION
-- =============================================================================

SELECT '=== VERIFICATION ===' AS Status;

-- Check FactoryEmployees
SELECT 'FactoryEmployees integrity:' AS Check_Name;
SELECT COUNT(*) as orphan_count
FROM FactoryEmployees fe
LEFT JOIN Factories f ON fe.FactoryID = f.ID
WHERE f.ID IS NULL;

-- Check Orders -> Fitters (16 expected, preserved)
SELECT 'Orders -> Fitters orphans (expected: 16, preserved):' AS Check_Name;
SELECT COUNT(*) as orphan_count
FROM Orders o
LEFT JOIN Fitters f ON o.FitterID = f.ID
WHERE o.FitterID > 0 AND f.ID IS NULL;

-- Check Customers -> Fitters (3 expected, preserved)
SELECT 'Customers -> Fitters orphans (expected: 3, preserved):' AS Check_Name;
SELECT COUNT(*) as orphan_count
FROM Customers c
LEFT JOIN Fitters f ON c.FitterID = f.ID
WHERE c.FitterID > 0 AND f.ID IS NULL;

SET FOREIGN_KEY_CHECKS = 1;

SELECT '=== ALL FIXES COMPLETE ===' AS Status;
