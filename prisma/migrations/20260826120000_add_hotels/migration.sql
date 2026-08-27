CREATE TYPE "HotelReservationStatus" AS ENUM ('CONFIRMED', 'CANCELLED');
CREATE TABLE "hotels" (
    "id" TEXT NOT NULL, "code" TEXT NOT NULL, "name" TEXT NOT NULL, "city" TEXT NOT NULL, "state" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "hotels_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "hotel_rooms" (
    "id" TEXT NOT NULL, "hotelId" TEXT NOT NULL, "name" TEXT NOT NULL, "description" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL, "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "hotel_rooms_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "hotel_reservations" (
    "id" TEXT NOT NULL, "code" TEXT NOT NULL, "hotelId" TEXT NOT NULL, "roomId" TEXT NOT NULL,
    "guestName" TEXT NOT NULL, "email" TEXT, "phone" TEXT, "checkIn" DATE NOT NULL, "checkOut" DATE NOT NULL,
    "status" "HotelReservationStatus" NOT NULL DEFAULT 'CONFIRMED', "pixCode" TEXT NOT NULL, "pixLink" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "hotel_reservations_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "hotels_code_key" ON "hotels"("code");
CREATE UNIQUE INDEX "hotel_rooms_hotelId_name_key" ON "hotel_rooms"("hotelId", "name");
CREATE UNIQUE INDEX "hotel_reservations_code_key" ON "hotel_reservations"("code");
CREATE INDEX "hotels_city_state_idx" ON "hotels"("city", "state");
CREATE INDEX "hotel_rooms_hotelId_isActive_idx" ON "hotel_rooms"("hotelId", "isActive");
CREATE INDEX "hotel_reservations_hotelId_checkIn_checkOut_idx" ON "hotel_reservations"("hotelId", "checkIn", "checkOut");
CREATE INDEX "hotel_reservations_roomId_checkIn_checkOut_idx" ON "hotel_reservations"("roomId", "checkIn", "checkOut");
CREATE INDEX "hotel_reservations_status_idx" ON "hotel_reservations"("status");
ALTER TABLE "hotel_rooms" ADD CONSTRAINT "hotel_rooms_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "hotels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "hotel_reservations" ADD CONSTRAINT "hotel_reservations_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "hotels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "hotel_reservations" ADD CONSTRAINT "hotel_reservations_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "hotel_rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;