import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";


export async function GET() {

  try {

    // USERS
    const { data: users, error: usersError } =
      await supabaseAdmin
        .from("profiles")
        .select("*")
        .order("xp", {
          ascending: false
        });


    if(usersError){
      throw usersError;
    }


    // TOTAL XP
    const totalXP =
      users?.reduce(
        (sum,user)=> sum + user.xp,
        0
      ) || 0;


    // ACTIVE USERS
    const { count: activeUsers } =
      await supabaseAdmin
        .from("profiles")
        .select("*", {
          count:"exact",
          head:true
        })
        .gte(
          "last_study_date",
          new Date()
            .toISOString()
            .split("T")[0]
        );



    return NextResponse.json({

      users: users ?? [],

      stats:{
        totalUsers: users?.length ?? 0,
        totalXP,
        activeUsers: activeUsers ?? 0
      }

    });



  } catch(error:any){

    console.error(
      "ADMIN DASHBOARD ERROR:",
      error
    );


    return NextResponse.json(
      {
        error:error.message
      },
      {
        status:500
      }
    );

  }

}