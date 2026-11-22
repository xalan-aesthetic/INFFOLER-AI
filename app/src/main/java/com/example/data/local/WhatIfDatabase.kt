package com.example.data.local

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase

@Database(
    entities = [ConversationEntity::class, MessageEntity::class, SimulationEntity::class],
    version = 1,
    exportSchema = false
)
abstract class WhatIfDatabase : RoomDatabase() {
    abstract fun whatIfDao(): WhatIfDao

    companion object {
        @Volatile
        private var INSTANCE: WhatIfDatabase? = null

        fun getInstance(context: Context): WhatIfDatabase {
            return INSTANCE ?: synchronized(this) {
                INSTANCE ?: Room.databaseBuilder(
                    context.applicationContext,
                    WhatIfDatabase::class.java,
                    "project_what_if.db"
                ).build().also { INSTANCE = it }
            }
        }
    }
}
